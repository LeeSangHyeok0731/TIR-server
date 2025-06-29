require("dotenv").config();
const express = require("express");
const cors = require("cors");
const oracledb = require("oracledb");
const jwt = require("jsonwebtoken");

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

// JWT 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  console.log("인증 미들웨어 실행");
  console.log("요청 URL:", req.url);
  console.log("요청 메서드:", req.method);

  const authHeader = req.headers["authorization"];
  console.log("Authorization 헤더:", authHeader);

  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN
  console.log("추출된 토큰:", token ? "토큰 존재" : "토큰 없음");

  if (!token) {
    console.log("토큰이 없어서 401 에러 반환");
    return res.status(401).json({ message: "액세스 토큰이 필요합니다." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log("토큰 검증 실패:", err.message);
      return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
    }
    console.log("토큰 검증 성공, 사용자:", user);
    req.user = user;
    next();
  });
};

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

// 랜덤 영화 리스트 10개 조회 API
app.get("/introduce", async (req, res) => {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT * FROM (SELECT * FROM MOVIERATING ORDER BY DBMS_RANDOM.VALUE) WHERE ROWNUM <= 10",
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

    const accessToken = jwt.sign(
      { email: user.EMAIL },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    res.json({ message: "로그인 성공", accessToken: accessToken });
  } catch (err) {
    console.error("로그인 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});

// 평점 추가/수정 API
app.post("/rating", authenticateToken, async (req, res) => {
  const { movieId, movieTitle, rating } = req.body;
  const userEmail = req.user.email;
  let connection;

  // 평점 유효성 검사 (0~5점)
  if (rating < 0 || rating > 5 || !Number.isInteger(rating)) {
    return res
      .status(400)
      .json({ message: "평점은 0~5 사이의 정수여야 합니다." });
  }

  try {
    connection = await oracledb.getConnection(dbConfig);

    // 이미 평점을 남긴 영화인지 확인
    const checkRating = await connection.execute(
      "SELECT * FROM USER_RATINGS WHERE USER_EMAIL = :email AND MOVIE_ID = :movieId",
      [userEmail, movieId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkRating.rows.length > 0) {
      // 기존 평점 수정
      await connection.execute(
        "UPDATE USER_RATINGS SET RATING = :rating, UPDATED_AT = SYSDATE WHERE USER_EMAIL = :email AND MOVIE_ID = :movieId",
        [rating, userEmail, movieId],
        { autoCommit: true }
      );
      res.json({ message: "평점이 수정되었습니다." });
    } else {
      // 새로운 평점 추가
      await connection.execute(
        "INSERT INTO USER_RATINGS (ID, USER_EMAIL, MOVIE_ID, MOVIE_TITLE, RATING, CREATED_AT) VALUES (USER_RATINGS_SEQ.NEXTVAL, :email, :movieId, :movieTitle, :rating, SYSDATE)",
        [userEmail, movieId, movieTitle, rating],
        { autoCommit: true }
      );
      res.status(201).json({ message: "평점이 추가되었습니다." });
    }
  } catch (err) {
    console.error("평점 추가/수정 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});

// 사용자 평점 목록 조회 API
app.get("/ratings", authenticateToken, async (req, res) => {
  console.log("GET /ratings 요청 받음");
  console.log("사용자 이메일:", req.user.email);

  const userEmail = req.user.email;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log("DB 연결 성공");

    const result = await connection.execute(
      "SELECT * FROM USER_RATINGS WHERE USER_EMAIL = :email ORDER BY CREATED_AT DESC",
      [userEmail],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log("조회된 평점 수:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("평점 조회 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});

// 특정 영화의 평점 조회 API
app.get("/ratings/:movieId", async (req, res) => {
  const { movieId } = req.params;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT AVG(RATING) as AVERAGE_RATING, COUNT(*) as TOTAL_RATINGS FROM USER_RATINGS WHERE MOVIE_ID = :movieId",
      [movieId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const stats = result.rows[0];
    res.json({
      movieId: movieId,
      averageRating: stats.AVERAGE_RATING
        ? parseFloat(stats.AVERAGE_RATING).toFixed(1)
        : 0,
      totalRatings: parseInt(stats.TOTAL_RATINGS),
    });
  } catch (err) {
    console.error("영화 평점 통계 조회 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});

// 평점 삭제 API
app.delete("/ratings/:movieId", authenticateToken, async (req, res) => {
  const { movieId } = req.params;
  const userEmail = req.user.email;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "DELETE FROM USER_RATINGS WHERE USER_EMAIL = :email AND MOVIE_ID = :movieId",
      [userEmail, movieId],
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ message: "평점을 찾을 수 없습니다." });
    }

    res.json({ message: "평점이 삭제되었습니다." });
  } catch (err) {
    console.error("평점 삭제 실패:", err);
    res.status(500).json({ message: "서버 에러" });
  } finally {
    if (connection) await connection.close();
  }
});

/*
-- 시퀀스 생성
CREATE SEQUENCE USER_RATINGS_SEQ
    START WITH 1
    INCREMENT BY 1
    NOCACHE
    NOCYCLE;

-- 테이블 생성
CREATE TABLE USER_RATINGS (
    ID NUMBER PRIMARY KEY,
    USER_EMAIL VARCHAR2(100) NOT NULL,
    MOVIE_ID VARCHAR2(50) NOT NULL,
    MOVIE_TITLE VARCHAR2(200) NOT NULL,
    RATING NUMBER(1) NOT NULL,
    CREATED_AT DATE DEFAULT SYSDATE,
    UPDATED_AT DATE DEFAULT SYSDATE,
    CONSTRAINT CHK_RATING CHECK (RATING >= 0 AND RATING <= 5),
    CONSTRAINT UK_USER_MOVIE UNIQUE (USER_EMAIL, MOVIE_ID)
);

-- 인덱스 생성
CREATE INDEX IDX_USER_RATINGS_USER ON USER_RATINGS(USER_EMAIL);
CREATE INDEX IDX_USER_RATINGS_MOVIE ON USER_RATINGS(MOVIE_ID);

commit;

*/
