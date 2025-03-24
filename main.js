const https = require('https');
const express = require('express');
const fs = require('fs');
const path = require('path');
const socketio = require('socket.io');
const nocache = require('nocache');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.static("public"));
app.use(nocache());

app.get('/receive', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "receive.html"));
});

app.get('/share', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "share.html"));
});

const key = fs.readFileSync('local/cert.key');
const cert = fs.readFileSync('local/cert.crt');
const httpsServer = https.createServer({ key, cert }, app);

// TODO: add some form of authentication
const io = socketio(httpsServer, {
  cors: {
    origin: ["*"],
    methods: ["GET", "POST"]
  }
});
let offers = [];

io.on('connection', socket => {
  if (offers.length) {
    socket.emit("offers", offers);
  }

  socket.on('newOffer', offer => {
    offers.push({
      id: uuidv4(),
      offerer: socket.id,
      offer: offer,
      offerIceCandidates: [],
      answer: null,
      answerIceCandidates: []
    });
    socket.broadcast.emit("offers", offers);
  });

  socket.on('newAnswer', (offer, ack) => {
    offers = offers.filter(o => o.id === offer.id).map(o => {
      ack(o.offerIceCandidates);

      const updated = {
        ...o,
        answer: offer.answer,
        answerer: socket.id
      };
      socket.to(offer.offerer).emit('answerResponse', updated);
      return updated;
    });
  });

  socket.on('newIceCandidate', c => {
    const { issuer, candidate } = c;
    if (issuer === "offerer") {
      offers = offers.filter(o => o.offerer === socket.id).map(o => {
        const updated = {
          ...o,
          offerIceCandidates: [...o.offerIceCandidates, candidate]
        };
        if (o.answerer) {
          socket.to(o.answerer).emit('broadcastIceCandidate', candidate);
        }
        return updated;
      });
    } else {
      offers = offers.filter(o => o.answerer === socket.id).map(o => {
        const updated = {
          ...o,
          answerIceCandidates: [...o.answerIceCandidates, candidate]
        };
        if (o.offerer) {
          socket.to(o.offerer).emit('broadcastIceCandidate', candidate);
        }
        return updated;
      });
    }
  });

  socket.on('disconnect', () => {
    offers = offers.filter(
      o => o.offerer !== socket.id);
  });
});

httpsServer.listen(8080);