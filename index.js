const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
  }
app.use(cors(corsOptions))

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    });
};

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zvmk2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("summerCamp").collection("users");
    const classesCollection = client.db("summerCamp").collection("classes");
    const instructorCollection = client.db("summerCamp").collection("instructor");
    // const selectClsCollection = client.db("Sportify").collection("selectClass");
    const addtocartCollection = client.db('summerCamp').collection('addtocart');
    const paymentCollection=client.db('summerCamp').collection('paymentSuccessList');


    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

        res.send({ token })
    })

    //verify admin
    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        if (user?.role !== 'admin') {
            return res.status(403).send({ error: true, message: 'forbidden message' });
        }
        next();
    }

    // check admin and verifyJWT
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.send({ admin: false });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { admin: user?.role === "admin" };
        res.send(result);
      });

    //verify instructor
      const verifyInstructor = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        if (user?.role !== "instructor") {
          return res
            .status(403)
            .send({ error: true, message: "forbidden access" });
        }
        next();
      };

     // check instructor and verify instructor
     app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.send({ instructor: false });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { instructor: user?.role === "instructor" };
        res.send(result);
      });

    app.put('/users/:email',async(req,res)=>{
        const email=req.params.email;
        const user=req.body;
        const query={email:email}
        const options={upsert:true}
        const updateDoc={
            $set:user
        }
        const result=await usersCollection.updateOne(query,updateDoc, options);
        res.send(result)
    })
    app.get('/users',async(req,res)=>{
      const result=await usersCollection.find({}).toArray();
      res.send(result);
    })
    app.get('/usersrole',async(req,res)=>{
      const result=await usersCollection.find({role:"instructor"}).toArray();
      res.send(result);
    })

    app.post('/classes',async(req,res)=>{
      const classes=req.body;
      const result=await classesCollection.insertOne(classes);
      res.send(result); 
    });
    app.post('/instructor',async(req,res)=>{
      const instructor=req.body;
      const result=await instructorCollection.insertOne(instructor);
      res.send(result);
    })
    app.get('/instructor',async(req,res)=>{
      const result=await instructorCollection.find({}).toArray();
      res.send(result);
    });


    //showing individual class data

    app.get("/classes/:email", async (req, res) => {
        const email = req.params.email;
        const result = await classesCollection.find({instructorEmail: email,}).toArray();
        res.send(result);
      });
  
      app.get('/classes',async(req,res)=>{
        const result=await classesCollection.find({}).toArray();
        res.send(result);
      });
      // app.get('/classes/:id',async(req,res)=>{
      //   const id = req.params.id
      //   console.log(id)
      //   const query = {_id: new ObjectId(id)}
      //   console.log(query);
      //   const result = await classesCollection.findOne(query)
      //   res.send(result)
      // });
      app.get('/singleclass/:id', async(req,res)=>{
        const id=req.params.id
       // console.log(id);
        const query = {_id: new ObjectId(id)}
        //console.log(query);
        const result = await classesCollection.findOne(query)
        res.send(result);
      });
      app.put('/classes/:id',async(req,res)=>{
        const id=req.params.id;
        const update=req.body;
        const query={ _id: new ObjectId(id)};
        //const options = { upsert: true };
        const updatedClass={
            $set:{
               ...update
            }
        }
        const result=await classesCollection.updateOne(query,updatedClass);
        res.send(result);
    });

    //approve class admin dashboard
    app.patch("/class/approve/:id", async (req, res) => {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
          $set: {
            status: "approved",
          },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
          });
      
          app.patch("/class/deny/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
              $set: {
                status: "denied",
              },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
          })

    //get data by status

     app.get("/approvedClasses", async (req, res) => {
        const status = req.query.status;
        //console.log(status);
        const result = await classesCollection.find({ status: status }).toArray();
  
        res.send(result);
      });
  
      app.put('/feedback/:id',async(req,res)=>{
        const id=req.params.id;
        //console.log(id);
        const body=req.body;
        const query={_id:new ObjectId(id)}
        const updateDoc={
          $set: {
            feedback:body
          }
        }
        const result=await classesCollection.updateOne(query,updateDoc)
        //console.log(result)
        res.send(result);
      })
  
  
      app.delete('/users/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(query);
        res.send(result);
    })
  
    app.patch('/users/admin/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                role: 'admin'
            },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    })
  
    app.patch('/users/instructor/:id', async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                role: 'instructor'
            },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
    })

    //addtocart
    app.post('/addtocart',async(req,res)=>{
    const info=req.body;
    const result=await addtocartCollection.insertOne(info);
    res.send(result);
  })
    app.get('/addtocart',async(req,res)=>{
    const result=await addtocartCollection.find({}).toArray();
    res.send(result);
  })

  app.get('/addtoclass/:id',async(req,res)=>{
    const id=req.params.id;
    //console.log(id);
    const filter = { _id: new ObjectId(id) };
    const result=await addtocartCollection.findOne(filter);
    //console.log(result);
    res.send(result);
  })


    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
        const { price } = req.body;
        const priceAsNumber = parseFloat(price);
        console.log(typeof priceAsNumber);
        const amount = price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
       });
      app.post("/payments", async (req, res) => {
        const payment = req.body;
        const beforePaymentClassId = payment.beforePaymentClassId;
        console.log(beforePaymentClassId)

    // Decrement the available seats count by 1 in the classes collection
    const updateResult = await classesCollection.updateOne(
        { _id: new ObjectId(beforePaymentClassId) },
        { $inc: { enrolledStudent: 1, availableSeat: -1 } }
      );
      console.log(updateResult)
  
      const sendDataToPaymentCollections = await paymentCollection.insertOne(
        payment
      );
      const id = payment.beforePaymentClassId;
  
      const query = { _id: new ObjectId(id) };
      const deleteResult = await addtocartCollection.deleteOne(query);
      res.send({ updateResult, deleteResult });
    });

    // Fetch the top 6 classes based on the number of students
    app.get("/popularClasses", async (req, res) => {
        const query = { status: "approved" };
        const result = await classesCollection
          .find(query)
          .sort({
            enrolledStudent: -1,
          })
          .limit(6)
          .toArray();
        res.send(result);
      });
    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) =>{
    res.send('Sportify is running');
})

app.listen(port, () =>{
    console.log(`Sportify is running on port ${port}`)
})




