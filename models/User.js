import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'billing', 'tech_support', 'sales', 'hr', 'it'],
    required: true
  }
}, { timestamps: true })

export default mongoose.model('User', userSchema)
