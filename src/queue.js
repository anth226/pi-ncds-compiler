import * as ncds from "./controllers/ncds";

import db2 from "./db2";

const { Consumer } = require("sqs-consumer");

const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

export function publish_SmartOptions(rawTrades) {
  let queueUrl = process.env.AWS_SQS_URL_SMART_OPTIONS;

  let data = {
    rawTrades,
  };

  let params = {
    MessageAttributes: {
      rawTrades: {
        DataType: "String",
        StringValue: `${data.rawTrades}`,
      },
    },
    MessageBody: JSON.stringify(data),
    QueueUrl: queueUrl,
  };

  // Send the order data to the SQS queue
  sqs.sendMessage(params, (err, data) => {
    if (err) {
      console.log("error", err);
    } else {
      console.log("queue success =>", data.MessageId);
    }
  });
}

// AWS_SQS_URL_SMART_OPTIONS
export const consumer_1 = Consumer.create({
  queueUrl: process.env.AWS_SQS_URL_SMART_OPTIONS,
  handleMessage: async (message) => {
    let sqsMessage = JSON.parse(message.Body);

    //console.log(sqsMessage);

    let rawTrades = sqsMessage.rawTrades;

    let ticker = rawTrades[0].ticker;
    let time = rawTrades[0].time;
    let exp = rawTrades[0].exp;
    let strike = rawTrades[0].strike;
    let cp = rawTrades[0].cp;
    let spot = rawTrades[0].spot;
    let type = rawTrades[0].type;
    let optContract = rawTrades[0].option_contract;
    let contract_quantity = 0;
    let total_amount = 0;

    console.log(
      "trade time: ",
      time,
      "trade ticker: ",
      ticker,
      "trade optContract: ",
      optContract
    );

    for (let j in rawTrades) {
      contract_quantity += rawTrades[j].volume;
      total_amount += rawTrades[j].price * rawTrades[j].volume;
    }

    let price_per_contract = total_amount / contract_quantity;

    let prem = contract_quantity * price_per_contract * 100;

    if (prem < 3000) {
      return;
    }

    let smTrade = await ncds.getSmartTrade(optContract, time);
    //console.log("smTrade", smTrade);

    if (smTrade) {
      //update
      let query = {
        text:
          "UPDATE options_test SET contract_quantity = $3, price_per_contract = $4, prem = $5 WHERE option_contract = $1 AND time = $2",
        values: [
          optContract,
          time,
          contract_quantity,
          price_per_contract,
          prem,
        ],
      };

      await db2(query);
      console.log("smart option trade updated");
    } else {
      //insert
      let query = {
        text:
          "INSERT INTO options_test (ticker, time, exp, strike, cp, spot, type, contract_quantity, price_per_contract, prem, option_contract) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        values: [
          ticker,
          time,
          exp,
          strike,
          cp,
          spot,
          type,
          contract_quantity,
          price_per_contract,
          prem,
          optContract,
        ],
      };
      await db2(query);
      console.log("smart option trade added");
    }
    console.log("finished raw trade compilation");
  },
});

consumer_1.on("error", (err) => {
  console.error(err.message);
});

consumer_1.on("processing_error", (err) => {
  console.error(err.message);
});
