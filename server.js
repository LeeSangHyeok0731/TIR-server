require("dotenv").config();
const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");

const app = express();
const PORT = 4000;

app.use(cors());

app.use(express.json()); // JSON 요청 처리용

app.listen(PORT, () => {
  console.log(`Oracle 서버가 http://localhost:${PORT} 에서 실행 중`);
});

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

app.get("/man", async (req, res) => {
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

app.get("/woman", async (req, res) => {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT * FROM MOVIERATING WHERE PREFER = 'woman'",
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

const bcrypt = require("bcrypt");

app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    // 이미 존재하는 이메일인지 확인
    const checkUser = await connection.execute(
      "SELECT * FROM USERS WHERE EMAIL = :email",
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "이미 존재하는 이메일입니다." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      "INSERT INTO USERS (EMAIL, PASSWORD) VALUES (:email, :password)",
      [email, hashedPassword],
      { autoCommit: true }
    );

    res.status(201).json({ message: "회원가입 성공" });
  } catch (err) {
    console.error("회원가입 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});

const jwt = require("jsonwebtoken");

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("로그인 시도 이메일:", email);
  console.log("로그인 시도 비밀번호:", password);

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT * FROM USERS WHERE EMAIL = :email",
      { email }, // 객체 바인딩
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log("DB 조회 결과:", result.rows);

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "존재하지 않는 이메일입니다." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.PASSWORD);

    if (!isMatch) {
      return res.status(400).json({ message: "비밀번호가 틀렸습니다." });
    }

    const token = jwt.sign({ email: user.EMAIL }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ message: "로그인 성공", token });
  } catch (err) {
    console.error("로그인 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});
