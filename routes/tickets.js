import express from 'express';
import Ticket from '../models/Ticket.js';
import { classifyAndSummarizeEmail } from '../utils/openrouter.js';
import nodemailer from 'nodemailer';
import { getEmbedding } from '../utils/embeddings.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const ticket = new Ticket(req.body);
    const saved = await ticket.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { team, status = 'open' } = req.query;
    if (team === 'Admin') {
        const tickets = await Ticket.find({ status }).sort({ priority: 1, createdAt: -1 });
        res.json(tickets);
    }
    else{
        const tickets = await Ticket.find({ team, status }).sort({ priority: 1, createdAt: -1 });
        res.json(tickets);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { team } = req.query;
    if(team === 'Admin'){
        const tickets = await Ticket.find({ status: { $in: ['closed', 'spam'] } }).sort({ updatedAt: -1 });
        res.json(tickets);
    }
    else {
        const tickets = await Ticket.find({ team, status: { $in: ['closed', 'spam'] } }).sort({ updatedAt: -1 });
        res.json(tickets);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/close', async (req, res) => {
  try {
    const updated = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', updatedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/spam', async (req, res) => {
  try {
    const updated = await Ticket.findByIdAndUpdate(
      req.params.id,
      { status: 'spam', updatedAt: new Date() },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/from-email', async (req, res) => {
    try {
      const { sender, body } = req.body;
  
      if (!sender || !body) {
        return res.status(400).json({ error: 'Sender and body are required' });
      }
  
      const llmData = await classifyAndSummarizeEmail(body);
  
      const newTicket = new Ticket({
        sender,
        body,
        team: llmData.team,
        priority: llmData.priority,
        subject: llmData.subject,
        summary: llmData.summary,
        status: 'open',
        createdAt: new Date(),
      });
  
      const savedTicket = await newTicket.save();
      res.status(201).json(savedTicket);
    } catch (err) {
      console.error('Ticket creation error:', err);
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  });

router.get('/analytics', async (req, res) => {
    try {
        const [statusCounts, priorityCounts, teamCounts, createdOverTime] = await Promise.all([
        Ticket.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),
        Ticket.aggregate([
            { $group: { _id: "$priority", count: { $sum: 1 } } }
        ]),
        Ticket.aggregate([
            { $group: { _id: "$team", count: { $sum: 1 } } }
        ]),
        Ticket.aggregate([
            {
            $group: {
                _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                },
                count: { $sum: 1 }
            }
            },
            { $sort: { _id: 1 } }
        ])
        ]);

        res.json({
        statusCounts,
        priorityCounts,
        teamCounts,
        createdOverTime,
        });
    } catch (err) {
        console.error("Analytics fetch failed:", err);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const { message } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Send mail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.REPLY_EMAIL,
        pass: process.env.REPLY_EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.REPLY_EMAIL,
      to: ticket.sender,
      subject: `Re: ${ticket.subject}`,
      text: message,
    });

    // Save reply to DB
    ticket.reply = message;
    await ticket.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.post('/search-similar', async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
  return res.status(400).json({ error: 'Query text is required' });
  }
  
  try {
  // Step 1: Generate embedding for the user query
  const embedding = await getEmbedding([query]);
  const vector = Array.from(embedding);

  
  // Step 2: Perform vector search in the Ticket collection
  const similarTickets = await Ticket.aggregate([
    {
      $vectorSearch: {
        index: 'Ticket_Embeddings',
        queryVector: vector,
        path: 'vector',
        numCandidates: 100,
        limit: 3
      }
    },
    {
      $project: {
        summary: 1,
        subject: 1,
        reply: 1,
        similarityScore: { $meta: 'vectorSearchScore' }
      }
    }
  ]);
  
  // return res.status(200).json({ results: similarTickets });
  console.log(similarTickets);

// Return the similar tickets including replies
return res.status(200).json({
  results: similarTickets.map(ticket => ({
    subject: ticket.subject,
    summary: ticket.summary,
    reply: ticket.reply,
    similarityScore: ticket.similarityScore
  }))
});
  
  } catch (error) {
  console.error('Error fetching similar tickets:', error);
  return res.status(500).json({ error: 'Internal server error' });
  }
  });
  

export default router;
