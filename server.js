const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const cors = require("cors");


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes

mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  userName: String,
  token: String,
  password: String,
});

const User = mongoose.model("User", userSchema);

app.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password"); // exclude password field
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/register", async (req, res) => {
  const { firstName, lastName, userName, token, password } = req.body;
  if (token.length !== 6 || isNaN(token)) {
    return res.status(400).send({ message: "Token must be a 6-digit number" });
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const hashedToken = await bcrypt.hash(token, salt);
  const user = new User({
    firstName,
    lastName,
    userName,
    token: hashedToken,
    password: hashedPassword,
  });
  await user.save();
  res.send({ message: "User created successfully" });
});


app.post("/login", async (req, res) => {
  const { userName, token } = req.body;
  if (token.length !== 6 || isNaN(token)) {
    return res.status(400).send({ message: "Token must be a 6-digit number" });
  }
  const user = await User.findOne({ userName });
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  const isValidToken = await bcrypt.compare(token, user.token);
  if (!isValidToken) {
    return res.status(401).send({ message: "Invalid token" });
  }
  res.send({ message: "Login successful" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});