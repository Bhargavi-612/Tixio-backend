import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  team: {
    type: String,
    enum: ['Billing', 'Tech Support', 'Sales', 'HR', 'IT'],
    required: true
  },
  priority: { type: Number, min: 1, max: 5, required: true },
  subject: { type: String, required: true },
  summary: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed', 'spam'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
