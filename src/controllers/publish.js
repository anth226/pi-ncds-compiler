import { messaging } from "../Firebase/Firebase";

export async function sendToTopic(trade) {
    let topic = process.env.REACT_APP_FCM_REALTIME_TOPIC;

    let jsonTrade = JSON.stringify(trade);

    // console.log(jsonTrade);
    // return;

    let message = {
      data: {
        option_trade: jsonTrade
      },
      topic: topic
    };

    messaging.send(message)
      .then((response) => {
        // Response is a message ID string.
        console.log('Successfully sent message:', response);
      })
      .catch((error) => {
        console.log('Error sending message:', error);
      });
}

export async function sendMultipleTrades(num, shouldBatch) {
    let count = 10;

    if (num && num > 0 && num < 20) {
        count = num;
    }

    let tickers = ['TSLA', 'AAPL', 'NVDA', 'COHU', 'SPY', 'NIO'];

    (async function sendLoop() {
        for (let i = 0; i < count; i++) {
            let rnd = Math.floor(Math.random() * Math.floor(3000)) + 1000
            await new Promise(resolve => setTimeout(resolve, rnd));
            let time = String(Math.round(Date.now() / 1000));

            const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];

            let trade = {
                time: time,
                ticker: randomTicker,
                exp: "2021-03-19T00:00:00.000Z",
                strike: "222",
                cp: "P",
                spot: "234.26",
                contract_quantity: 98,
                price_per_contract: "0.47",
                type: "SWEEP",
                prem: "4605.999999999999"
            };

            if (shouldBatch) {
                let rndBatch = Math.floor(Math.random() * 5)+1;
                let trades = [trade];
                for (let j = 0; j < rndBatch; j++) {
                    let t = trade;
                    const rndTicker = tickers[Math.floor(Math.random() * tickers.length)];
                    t.ticker=rndTicker;
                    trades.push(t)
                }
                await sendToTopic(trades);
            } else {
                await sendToTopic(trade);
            }
        }
    })();
}