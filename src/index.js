import "dotenv/config";
import express from "express";
// import admin from "firebase-admin";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";

// import * as companies from "./controllers/companies";
// import * as securities from "./controllers/securities";
// import * as earnings from "./controllers/earnings";
// import * as titans from "./controllers/titans";
// import * as holdings from "./controllers/holdings";
// import * as performances from "./controllers/performances";
// import * as institutions from "./controllers/institutions";
// import * as networth from "./controllers/networth";
// import * as widgets from "./controllers/widgets";
// import * as mutualfunds from "./controllers/mutualfunds";
// import * as etfs from "./controllers/etfs";
// import * as pages from "./controllers/pages";
// import * as nlp from "./controllers/nlp";
// import * as userPortfolios from "./controllers/userportfolios";
import * as ncds from "./controllers/ncds";
//import redis from "./redis";

import * as queue from "./queue";

var bugsnag = require("@bugsnag/js");
var bugsnagExpress = require("@bugsnag/plugin-express");

var bugsnagClient = bugsnag({
  apiKey: process.env.BUGSNAG_KEY,
  otherOption: process.env.RELEASE_STAGE,
});

bugsnagClient.use(bugsnagExpress);

var middleware = bugsnagClient.getPlugin("express");
/*
~~~~~~Configuration Stuff~~~~~~
*/
// debug
var rawBodySaver = function (req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || "utf8");
  }
};

// set up middlewares
const app = express();
app.use(cookieParser());
//app.use(express.json());
app.use(bodyParser.json({ verify: rawBodySaver }));
app.use(bodyParser.urlencoded({ verify: rawBodySaver, extended: true }));
app.use(bodyParser.raw({ verify: rawBodySaver, type: "*/*" }));
//for frontend
// app.use(express.static("dist"));

app.use(middleware.requestHandler);
app.use(middleware.errorHandler);

/*
~~~~~~Middlewares~~~~~~
*/

/*
~~~~~~Routes~~~~~~
*/

// index
app.get("/", async (req, res) => {
  res.send("hello!");
});

/* NCDS */
app.get("/ncds_consolidate", async (req, res) => {
  if (process.env.DISABLE_CRON == "true") {
    res.send("disabled");
    return;
  }
  let { query } = req;
  if (query.token != "XXX") {
    res.send("fail");
    return;
  }
  await ncds.consolidate();
  res.send("ok");
});

app.get("/ncds_consolidate/off", async (req, res) => {
  if (process.env.DISABLE_CRON == "true") {
    res.send("disabled");
    return;
  }
  let { query } = req;
  if (query.token != "XXX") {
    res.send("fail");
    return;
  }
  await ncds.turnOffConsolidator();
  res.send("ok");
});

// Start Server
app.listen(process.env.PORT || 8080, () => {
  console.log(`listening on ${process.env.PORT || 8080}`);

  queue.consumer_1.start();
});
