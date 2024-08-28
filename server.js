const express = require("express");
const bcrypt = require("bcryptjs");
const app = express();
const cors = require("cors");
app.use(express.json());
app.use(cors());
const users = [];

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", async (req, res) => {
  try {
    const { username, password, token, firstName, lastName } = req.body;
    if (!username || !password || !token || !firstName || !lastName) {
      return res.status(400).send("All fields are required");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedToken = await bcrypt.hash(token, 10);
    const user = {
      username,
      password: hashedPassword,
      token: hashedToken,
      firstName,
      lastName,
    };
    users.push(user);
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/users/login", async (req, res) => {
  try {
    const { username, token } = req.body;
    if (!username || !token) {
      return res.status(400).send("Username and token are required");
    }
    const user = users.find((user) => user.username === username);
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (await bcrypt.compare(token, user.token)) {
      res.send({ success: true });
    } else {
      res.send({ success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});
app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
