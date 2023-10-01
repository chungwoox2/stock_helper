const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
const port = 3001;

require("dotenv").config();

app.use(cors());

const dbConfig = {
  host: process.env.REACT_APP_DB_HOST,
  user: process.env.REACT_APP_DB_USERNAME,
  password: process.env.REACT_APP_DB_PASSWORD
};

const databases = [
  { name: 'daily_craw', connection: null }, // DB 0
  { name: 'daily_buy_list', connection: null }, // DB 1
  { name: 'stock_finance', connection: null }, // DB 2
  { name: 'processed_stock_data', connection: null } // DB 3
];

const connectToDatabases = async () => {
  for (const database of databases) {
    database.connection = mysql.createConnection({
      ...dbConfig,
      database: database.name
    });

    await new Promise((resolve, reject) => {
      database.connection.connect(error => {
        if (error) {
          console.error(`Error connecting to ${database.name} DB:`, error);
          reject(error);
        } else {
          console.log(`${database.name} 연결성공`);
          resolve();
        }
      });
    });
  }
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectToDatabases().catch(error => {
  console.error("Failed to connect to databases:", error);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.post("/search", async (req, res) => {
  const inputValue = req.body.name;
  console.log("Received search term:", inputValue);
  res.header("Access-Control-Allow-Origin", "*");

  try {
    const db1Results = await queryDatabase(
      databases[1].connection,
      `SELECT * FROM ${databases[1].name}.stock_item_all WHERE code = ? OR code_name = ?`,
      [inputValue, inputValue]
    );

    if (db1Results.length === 0) {
      return res.json({ message: "해당하는 종목이 없습니다." });
    }

    console.log("daily_buy_list 내의 검색 결과 : ", db1Results);
    const jkValue = db1Results[0].code_name.replace(/'/g, ""); // ex: jkValue = 삼성전자
    console.log(jkValue); // EX: 005930 입력 시, jkValue = '삼성전자' 로 daily_craw 테이블에서 검색

    const chartdata = await queryDatabase(
      databases[0].connection,
      // 아래 구문은 최신 DB Date가 3개월 초과하면 오류
      // `SELECT code, code_name, date, close FROM ${jkValue} WHERE date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)`
      // 땜빵 해둠
      `SELECT code, code_name, date, close FROM ${jkValue} WHERE date >= DATE_SUB('2023-06-09', INTERVAL 3 MONTH)`
    );

    if (chartdata.length === 0) {
      return res.json({ message: "table don't find 1, OR db is not up to date 3 months" });
    }
    console.log(chartdata);

    const finance = await queryDatabase(
      databases[2].connection,
      `SELECT IFRS, \`2020/12\`, \`2021/12\`, \`2022/12\`, \`2023/12(E)\` FROM ${jkValue}`
    );

    if (finance.length === 0) {
      return res.json({ message: "table don't find 2" });
    }
    console.log(finance);

    const recommend = await queryDatabase(
      databases[3].connection,
      `SELECT 종목명, 거래대금 FROM ${databases[3].name}.RAW_Data ORDER BY 거래대금 DESC LIMIT 3`
    );

    if (recommend.length === 0) {
      return res.json({ message: "table don't find 3" });
    }
    console.log(recommend);

    const rim = await queryDatabase(
      databases[3].connection,
      `SELECT 종목명, 업종, 종가, 거래대금, S_RIM, S_RIM_20, S_RIM_difr, S_RIM_10 FROM ${databases[3].name}.S_RIM_ALL_DATA`
    );

    if (rim.length === 0) {
      return res.json({ message: "table don't find 4" });
    }
    console.log(rim);

    const responseData = {
      results: chartdata,
      finance: finance,
      recommend: recommend,
      rim: rim,
    };

    res.json(responseData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function queryDatabase(connection, sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}
