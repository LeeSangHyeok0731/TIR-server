require("dotenv").config();
const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");

const app = express();
const PORT = 4000;

app.use(cors());

const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING || "localhost:1521/xe",
};

// 전체 데이터 조회 API
app.get("/oracle-data", async (req, res) => {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute("SELECT * FROM MOVIERATING", [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    res.json(result.rows);
  } catch (error) {
    console.error("DB 연결 실패:", error);
    res.status(500).json({ error: "DB 연결 실패" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("연결 종료 실패:", err);
      }
    }
  }
});

app.get("/manrating", async (req, res) => {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT * FROM MOVIERATING WHERE PREFER = 'man'",
      [],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    res.json(result.rows);
  } catch (error) {
    console.error("DB 연결 실패:", error);
    res.status(500).json({ error: "DB 연결 실패" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("연결 종료 실패:", err);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Oracle 서버가 http://localhost:${PORT} 에서 실행 중`);
});
