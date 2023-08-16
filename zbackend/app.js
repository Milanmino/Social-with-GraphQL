const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { createHandler } = require("graphql-http/lib/use/express");
require('dotenv').config()

const graphqlSchema = require("./graphql/schema");
const graphqlResolver = require("./graphql/resolvers");
const auth = require("./middleware/auth");
const { clearImage } = require("./util/file");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "images");
  },
  filename: (req, file, callback) => {
    callback(null, uuidv4() + ".jpg");
  },
});

const fileFilter = (req, file, callback) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    callback(null, true);
  } else {
    callback(null, false);
  }
};

app.use(bodyParser.json());
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    //so we don't get a 405 response when creating a new user
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not authenticated!");
  }
  if (!req.file) {
    return res.status(200).json({ message: "No file provided!" });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  return res.status(201).json({
    message: "File stored.",
    filePath: req.file.path.replace(/\\/g, "/"),
  });
});

app.all("/graphql", (req, res) =>
  createHandler({
    schema: graphqlSchema,
    rootValue: {
      createUser: (args) => graphqlResolver.createUser(args, req),
      login: (args) => graphqlResolver.login(args, req),
      createPost: (args) => graphqlResolver.createPost(args, req),
      posts: (args) => graphqlResolver.posts(args, req),
      post: (args) => graphqlResolver.post(args, req),
      updatePost: (args) => graphqlResolver.updatePost(args, req),
      deletePost: (args) => graphqlResolver.deletePost(args, req),
      user: (args) => graphqlResolver.user(args, req),
      updateStatus: (args) => graphqlResolver.updateStatus(args, req)
    },
      formatError: (err) => {	
        if (!err.originalError) {	
          return err;	
        }	
        const data = err.originalError.data;	
        const message = err.message || "An error occurred.";	
        const code = err.originalError.code || 500;
        // console.log(code,message,data)	
        return { message: message, status: code, data: data };	
      },
  })(req, res)
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then((result) => {
    app.listen(process.env.PORT || 8080);
  })
  .catch((err) => console.log(err));
