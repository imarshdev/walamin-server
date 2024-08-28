const express = require("express");
const bcrypt = require("bcryptjs");
const app = express();
const cors = require("cors")
app.use(express.json());
app.use(cors())
const users = [];

app.get("/users", (req, res) => {
  res.json(users);
});

app.post("/users", async (req, res) => {
  try {
    if (!req.body.name || !req.body.password || !req.body.token) {
      return res.status(400).send("Name, password and token are required");
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const hashedToken = await bcrypt.hash(req.body.token, 10)
    const user = { name: req.body.name, password: hashedPassword, token: hashedToken };
    users.push(user);
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/users/login", async (req, res) => {
  try {
    if (!req.body.name || !req.body.token) {
      return res.status(400).send("Name and token are required");
    }
    const user = users.find((user) => user.name === req.body.name);
    if (!user) {
      return res.status(400).send("User not found");
    }
    if (await bcrypt.compare(req.body.token, user.token)) {
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
