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
        }
        catch (err) {
            console.error('Ticket creation error:', err);
          }
      };
    } else {
      console.log('No unread emails found.');
    }
  });
