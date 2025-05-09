import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'

import authRoutes from './routes/auth.routes.js'
import ticketRoutes from './routes/tickets.js'

import cron from 'node-cron';
import fetchEmails from './utils/fetchEmails.js';

import Ticket from './models/Ticket.js';
import { classifyAndSummarizeEmail } from './utils/openrouter.js';
import { getEmbedding } from './utils/embeddings.js';

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/tickets', ticketRoutes)

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('MongoDB connected')
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`)
  })
})
.catch(err => console.error(err))

function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (normA * normB);
}

// Cron job to run every 5 minutes (adjust as needed)
cron.schedule('*/1 * * * *', async () => {
    console.log('Fetching unread emails...');
    const emails = await fetchEmails();  // Call your function to fetch emails
    
    if (emails.length > 0) {
      console.log('Found unread emails:', emails);
      // Here you can add the logic to process the emails and create tickets
  
      // Example: create a ticket for each email (You can replace this with your logic)
      for (const { sender, body } of emails){
        try{
            const llmData = await classifyAndSummarizeEmail(body);
            const { team, priority, subject, summary } = llmData;

            // Step 2: Generate embedding from summary
            const vector1 = await getEmbedding([body]);
            const vector = Array.from(vector1);
            console.log(vector);

            // Step 3: Search for similar summaries within last 24h
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const similarTickets = await Ticket.aggregate([
              {
                $vectorSearch: {
                  index: 'Ticket_Embeddings',
                  queryVector: vector,
                  path: 'vector',
                  numCandidates: 100,
                  limit: 3
                }
              }
            ]);

            const threshold = 0.95;
            const similarDocs = similarTickets.filter(doc => cosineSimilarity(vector, doc.vector) > threshold);

            if (similarDocs.length > 0) {
              console.log(similarDocs);
              console.log('Duplicate ticket detected. Skipping creation.');
              continue;
            }
        
            const newTicket = new Ticket({
            sender,
            body,
            team: llmData.team,
            priority: llmData.priority,
            subject: llmData.subject,
            summary: llmData.summary,
            status: 'open',
            createdAt: new Date(),
            vector
            });
        
            const savedTicket = await newTicket.save();
        }
        catch (err) {
            console.error('Ticket creation error:', err);
          }
      };
    } else {
      console.log('No unread emails found.');
    }
  });
