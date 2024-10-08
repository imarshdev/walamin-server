const express = require("express");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://client-epae.onrender.com", // Allow requests from your frontend domain
    credentials: true, // Allow credentials (session cookies) to be included in requests
  },
});
app.use(express.json());
app.use(
  cors({
    origin: "https://client-epae.onrender.com", // Allow requests from your frontend domain
    credentials: true, // Allow credentials (session cookies) to be included in requests
  })
);

dotenv.config();
const port = process.env.PORT || 4000;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGO_URI);

const db = client.db();
const usersCollection = db.collection("users");
const ridesCollection = db.collection("rides"); // Define this after connecting to the database
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store,
  })
);

// Add these new variables at the top
const pendingRides = {}; // To store rides that are currently pending
const rideResponses = {}; // To track responses for each ride

io.on("connection", (socket) => {
  console.log("New client connected");

  // Listen for ride orders
  socket.on("orderRide", (rideDetails) => {
    console.log(rideDetails);
    const rideId = new Date().getTime().toString();
    pendingRides[rideId] = { ...rideDetails, rideId, status: "pending" };

    // Broadcast to all drivers
    socket.broadcast.emit("newRide", pendingRides[rideId]);

    // Handle ride acceptance timeout
    setTimeout(() => {
      if (pendingRides[rideId].status === "pending") {
        io.to(socket.id).emit("rideUpdate", {
          message: "We are sorry, no one was available to take your ride.",
        });
        delete pendingRides[rideId];
      }
    }, 60000); // 1 minute
  });

  // Listen for ride acceptances
  socket.on("acceptRide", (rideId, driverUsername) => {
    const ride = pendingRides[rideId];
    if (ride) {
      ride.status = "accepted";
      ride.acceptedBy = driverUsername;

      // Notify both user and driver
      io.to(ride.userId).emit("rideUpdate", {
        message: `Your ride has been accepted by ${driverUsername}.`,
      });
      socket.emit("rideUpdate", {
        message: `You accepted the ride.`,
      });

      delete pendingRides[rideId];
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/users", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { username, password, token, firstName, lastName } = req.body;
    if (!username || !password || !token || !firstName || !lastName) {
      return res.status(400).send("All fields are required");
    }
    const hashedToken = await bcrypt.hash(token, 10);
    const user = {
      username,
      password,
      token: hashedToken,
      firstName,
      lastName,
      rides: [],
      expressRides: [],
      location: {
        latitude: null,
        longitude: null,
        updatedAt: null,
      },
    };
    await usersCollection.insertOne(user);
    res.status(201).send({ message: "User created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/ride", async (req, res) => {
  try {
    const {
      username,
      token,
      rideCategory,
      pickupLocation,
      dropoffLocation,
      rideDate,
      rideTime,
    } = req.body;

    if (
      !username ||
      !token ||
      !rideCategory ||
      !pickupLocation ||
      !dropoffLocation ||
      !rideDate ||
      !rideTime
    ) {
      return res.status(400).send("All fields are required");
    }

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!(await bcrypt.compare(token, user.token))) {
      return res.status(401).send("Invalid token");
    }

    if (!user.rides) {
      user.rides = [];
    }

    user.rides.push({
      rideCategory,
      pickupLocation,
      dropoffLocation,
      rideDate,
      rideTime,
      rideStatus: "booked",
      timestamp: new Date(),
    });

    await usersCollection.updateOne({ username }, { $set: user });

    res.send({ message: "Ride booked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/all-rides", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    const allRides = users.reduce((acc, user) => {
      acc[user.username] = user.rides;
      return acc;
    }, {});
    res.json(allRides);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/all-express-rides", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    const allExpressRides = users.reduce((acc, user) => {
      acc[user.username] = {
        expressRides: user.expressRides.filter(
          (ride) => !ride.acceptedBy || ride.acceptedBy === req.query.username
        ),
        contact: user.password,
      };
      return acc;
    }, {});
    res.json(allExpressRides);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/rides/express", async (req, res) => {
  try {
    const { username, token, origin, destination, cost } = req.body;
    if (!username || !token || !origin || !destination) {
      return res.status(400).send("All fields are required");
    }
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (!(await bcrypt.compare(token, user.token))) {
      return res.status(401).send("Invalid token");
    }
    if (!user.expressRides) {
      user.expressRides = [];
    }
    user.expressRides.push({
      origin,
      destination,
      cost,
      rideStatus: "booked",
      timestamp: new Date(),
    });
    await usersCollection.updateOne({ username }, { $set: user });
    res.send({ message: "Express ride booked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/rides", async (req, res) => {
  try {
    const { username, token } = req.query;

    if (!username || !token) {
      return res.status(400).send("Username and token are required");
    }

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!(await bcrypt.compare(token, user.token))) {
      return res.status(401).send("Invalid token");
    }

    res.json(user.rides);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/user/details", async (req, res) => {
  try {
    const { username, token } = req.query;
    if (!username || !token) {
      return res.status(400).send("Username and token are required");
    }
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (!(await bcrypt.compare(token, user.token))) {
      return res.status(401).send("Invalid token");
    }
    const userDetails = {
      firstName: user.firstName,
      lastName: user.lastName,
      contact: user.password,
      username: user.username,
      rides: user.rides,
    };
    res.json(userDetails);
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
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (await bcrypt.compare(token, user.token)) {
      req.session.userId = user._id;
      console.log(req.session);
      res.send({
        success: true,
        name: user.firstName + " " + user.lastName,
      });
    } else {
      res.send({ success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/rides", async (req, res) => {
  try {
    const {
      rideCategory,
      pickupLocation,
      dropoffLocation,
      rideDate,
      rideTime,
    } = req.body;
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).send("Unauthorized");
    }
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return res.status(404).send("User not found");
    }
    user.rides.push({
      rideCategory,
      pickupLocation,
      dropoffLocation,
      rideDate,
      rideTime,
      rideStatus: "booked",
    });
    await usersCollection.updateOne({ _id: userId }, { $set: user });
    res.send({ message: "Ride booked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/user", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).send("Unauthorized");
    }
    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.send({ name: user.firstName + " " + user.lastName });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/accept-ride", async (req, res) => {
  try {
    const { username, rideId } = req.body;
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }
    const ride = user.expressRides.find((ride) => ride.timestamp === rideId);
    if (!ride) {
      return res.status(404).send("Ride not found");
    }
    ride.acceptedBy = username;
    await usersCollection.updateOne({ username }, { $set: user });
    res.send({ message: "Ride accepted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.post("/location", async (req, res) => {
  try {
    const { username, latitude, longitude, token } = req.body;
    if (!username || !latitude || !longitude || !token) {
      return res
        .status(400)
        .send("Username, latitude, and longitude are required");
    }
    const user = await usersCollection.findOne({ username });
    if (!user) {
      return res.status(404).send("User not found");
    }
    if (await bcrypt.compare(token, user.token)) {
      req.session.userId = user._id;
      console.log(req.session);
    } else {
      res.send({ success: false });
    }
    // Update user location
    await usersCollection.updateOne(
      { username },
      {
        $set: {
          location: {
            latitude,
            longitude,
            updatedAt: new Date(),
          },
        },
      }
    );

    res.send({
      success: true,
      name: user.firstName + " " + user.lastName,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/all-locations", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    const locations = users.map((user) => ({
      username: user.username,
      location: user.location,
    }));
    res.json(locations);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
