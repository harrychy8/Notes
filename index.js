const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
const pbkdf2 = require('pbkdf2');
const uuidv4 = require('uuid/v4');

//connect to database
const Sequelize = require('sequelize');
const sequelize = new Sequelize('handsomeNotes', 'handsome', 'nhj159zas-=', {
  host: 'hndb.database.windows.net',
  dialect: 'mssql',
  operatorsAliases: false,

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    encrypt: true
  }
});

sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });




//MODEL
const User = sequelize.define('user',{
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: Sequelize.STRING
  },
  password: {
    type: Sequelize.STRING
  },
});

const Note = sequelize.define('note',{
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  content: {
    type: Sequelize.TEXT
  },

});
const Token = sequelize.define('token',{
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tokenBody: {
    type: Sequelize.STRING
  },

});

User.hasMany(Note);
User.hasMany(Token);
User.sync();
Note.sync();
Token.sync();

function headerAuthMidware(req,res,next){
  Token.findOne({
    where: {
      tokenBody: req.header('authorization')
    }
  }).then(token => {
    if (!token){
      Promise.reject({
        error: "not authorized"
      })
    } else {
      return User.findOne({
        where: {
          id: token.userId
        }
      })
    }
  }).then(user => {
    if (user){
      req.user = user;
      next();
    } else {
      return Promise.reject({
        error: "not authorized"
      })
    }
  }).catch(e =>{
    res.status(401);
    res.send(e);
  })
}

app.get('/users/notes',headerAuthMidware,(req,res) => {
  req.user.getNotes().then(notes => res.send(notes));
});

app.post('/users/notes',headerAuthMidware,(req,res) => {
  if (req.body.content) {
    req.user.createNote({
      content : req.body.content
    }).then (note => {
      res.send(note)
    }).catch(e => {
      res.status(400);
      res.sned(e);
    })
  } else {
    res.status(400);
    res.send({
      error:"content is a required parameter"
    })
  }
});

app.delete('/users/notes/:noteId',headerAuthMidware,(req,res) => {
  Note.findOne({
    where: {
      userId: req.user.id,
      id: req.param('noteId')
    }
  }).then(note => {
    if (note){
      return note.destroy();
    } else {
      return Promise.reject({
        error: "Note not found"
      })
    }
  }).then(() => {
    res.send({
      status:"deleted"
    })
  }).catch(e => {
    res.status(400);
    res.send(e);
  })
});

app.put('/users/notes/:noteId',headerAuthMidware,(req,res) => {
  if (req.body.content) {
    Note.findOne({
      where: {
        userId: req.user.id,
        id: req.param('noteId')
      }
    }).then(note => {
      if (note){
        return note.update({
          content: req.body.content
        })
      } else {
        return Promise.reject({
          error: "Note not found"
        })
      }
    }).then(() => {
      res.send({
        status:"Updated"
      })
    }).catch(e => {
      res.status(400);
      res.send(e);
    })
  } else {
    res.status(400);
    res.send({
      error:"content is a required parameter"
    })
  }
});

app.post('/users',(req,res) => {
  if (req.body.username && req.body.password){
    let password = pbkdf2.pbkdf2Sync(req.body.password,'????',1,32,'sha512').toString('hex');

    User.findOne({
      where: {
        username: req.body.username
      }
    }).then(user => {
      if(user){
        return Promise.reject({
          error: "user already exists"
        })
      } else {
        return Promise.resolve();
      }
    }).then(() => {
      return User.create({
        username: req.body.username,
        password: password
      })
    }).then(user => {
      res.send(user);
    }).catch(e => {
      res.status(400);
      res.send(e);
    })
  } else {
    res.status(400);
    res.send("ni ma bi")
  }
});

app.post('/login',(req,res) => {
  if (req.body.username && req.body.password){
    let password = pbkdf2.pbkdf2Sync(req.body.password,'????',1,32,'sha512').toString('hex');

    User.findOne({
      where: {
        username: req.body.username,
        password: password
      }
    }).then(user => {
      if (!user){
        return Promise.reject({
          error: "wrong username or password"
        });
      } else {
        return user.createToken({
          tokenBody: uuidv4()
        })
      }
    }).then (token => {
      res.send(token);
    }).catch(e => {
      res.status(400);
      res.send(e);
    })
  } else {
    res.status(400);
    res.send("ni ma bi")
  }
});

const portNumber = process.env.port || process.env.PORT || 3000;

app.listen(portNumber,() => {
  console.log("hei hei hei",portNumber);
});
