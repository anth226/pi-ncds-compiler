import * as ncds from "./controllers/ncds";
import * as publish from "./controllers/publish"

import db2 from "./db2";
import {sendToTopic} from "./controllers/publish";

const { Consumer } = require("sqs-consumer");

const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });
const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

export function formatTrade(ticker, time, exp, strike, cp, spot, type, contract_quantity, price_per_contract, prem) {
  return {
  ticker: ticker,
  time: time,
  exp: exp,
  strike: strike,
  cp: cp,
  spot: spot,
  type: type,
  contract_quantity: contract_quantity,
  price_per_contract: price_per_contract,
  prem: prem
  }
};

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

    let smartTrades = new Map();

    for (let i in rawTrades) {
      let optContract = rawTrades[i].option_contract;
      if (smartTrades.has(optContract)) {
        let trades = await smartTrades.get(optContract);
        await trades.push(rawTrades[i]);
        smartTrades.set(optContract, trades);
      } else {
        let trades = [];
        trades.push(rawTrades[i]);
        smartTrades.set(optContract, trades);
      }
    }

    let smartTradesSize = smartTrades.size;
    let batch = [];
    let i = 0;

    smartTrades.forEach( async (value, key) => {
      let ticker = value[0].ticker;
      let time = value[0].time;
      let exp = value[0].exp;
      let strike = value[0].strike;
      let cp = value[0].cp;
      let spot = value[0].spot;
      let type = value[0].type;
      let optContract = value[0].option_contract;
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

      for (let j in value) {
        contract_quantity += value[j].volume;
        total_amount += value[j].price * value[j].volume;
      }

      let price_per_contract = total_amount / contract_quantity;

      let prem = contract_quantity * price_per_contract * 100;

      if (prem < 3000) {
        return;
      }

      let smTrade = await ncds.getSmartTrade(optContract, time);
      //console.log("smTrade", smTrade);

      let formattedTrade = formatTrade(ticker, time, exp, strike, cp, spot, type, contract_quantity, price_per_contract, prem);

      if (smTrade) {
        //update
        let query = {
          text:
            "UPDATE options SET contract_quantity = $3, price_per_contract = $4, prem = $5 WHERE option_contract = $1 AND time = $2",
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

        // TODO: Push updates as messages (searching the large array of data on frontend
        // console.log("Sending trade update to frontend");
        // publish.sendToTopic(formattedTrade);

      } else {
        //insert
        let query = {
          text:
            "INSERT INTO options (ticker, time, exp, strike, cp, spot, type, contract_quantity, price_per_contract, prem, option_contract) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
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
        if (batch.length < 5) {
          batch.push(formattedTrade);
        } else {
          console.log("Sending new trade to frontend");
          console.log("Send batch: ", batch);
          sendToTopic(batch);
          batch = [value];
        }
      }

      i += 1;
      if (i === smartTradesSize) {
        console.log("Send last: ", batch);
        sendToTopic(batch);
      }

      console.log("finished raw trade compilation");
    });
  },
});

consumer_1.on("error", (err) => {
  console.error(err.message);
});

consumer_1.on("processing_error", (err) => {
  console.error(err.message);
});
