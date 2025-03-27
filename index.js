const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Middleware for parsing URL encoded data
app.use(express.urlencoded({extended: true}))

// Mongoose setup
const databaseConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI).then(
      console.log("Connected to database!")
    )
  } catch (error) {
    console.log("Failed to connect to database", error)
  }
}
databaseConnect();

// Schema setup
const Schema = mongoose.Schema

const userSchema = new Schema({
  username: { type: String, required: true},
})

const exerciseSchema = new Schema({
  userID: String,
  description: String,
  duration: Number,
  date: Date 
})

const User = mongoose.model('User', userSchema)
const Exercise = mongoose.model('Exercise', exerciseSchema)

// Save new user
app.post('/api/users', async (req, res) => {
  const { username } = req.body
  
  // Save new user to database
  const newUser = new User({username});
  const savedUser = await newUser.save()
  const { _id } = savedUser

  res.json({username, _id})
})

// Get all users
app.get('/api/users', async (req, res) => {
  const users = await User.find().select('-__v -exercises')
  res.json(users)
})

// Post exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  const { description, duration, date } = req.body;
  const { _id } = req.params;

  // Set the date to today if not provided 
  const exerciseDate = date ? new Date(date) : new Date();

  // Check if the date is valid
  if (isNaN(exerciseDate.getTime())) {
    return res.status(400).send('Invalid date');
  }

  // Add new Exercise to database
  const newExercise = new Exercise({userID: _id, description, duration, date: exerciseDate})
  const savedExercise = await newExercise.save()
    
  // Get username 
  const { username } = await User.findOne({_id})

  const formattedDate = exerciseDate.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).replace(/,/g, '');

  const returnObj = {
    username,
    _id,
    description,
    duration: parseInt(duration),
    date: formattedDate, // Alter date to a more readable format
  }

  res.json(returnObj)
})

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params
  const { from, to, limit } = req.query;

  // Convert 'from' and 'to' to Date objects if provided
  let fromDate = from ? new Date(from) : null;
  let toDate = to ? new Date(to) : null;

  // Fetch exercises, applying filters if 'from' and 'to' are present
  let query = { userID: _id };
  if (fromDate || toDate) {
    query.date = {};
    if (fromDate) query.date.$gte = fromDate;
    if (toDate) query.date.$lte = toDate;
  }

  let userExercises = await Exercise.find(query)
    .select('-_id -userID -__v')
    .sort({ date: 1 }) // Sort logs by date
    .limit(limit ? parseInt(limit) : undefined); // Apply limit if provided

  // Get username 
  const user = await User.findById(_id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  // Get count of exercises
  const count = userExercises.length

    // Format response data
  const returnArray = userExercises.map((item) => ({
    description: item.description,
    duration: item.duration,
    date: item.date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).replace(/,/g, '')
  }));
  
  res.json({ 
    username: user.username, 
    count: returnArray.length, 
    _id, 
    log: returnArray 
  });
})

app.get('/api/deleteall', async (req, res) => {
  const deletedExercises = await Exercise.deleteMany()
  const deletedUsers = await User.deleteMany()
  res.json({exercisesDeleted: deletedExercises.deletedCount, usersDeleted: deletedUsers.deletedCount})
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening at ' + 'http://localhost:' + listener.address().port)
})
