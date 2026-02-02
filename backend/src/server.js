import express from 'express';
import path from 'path';
import { ENV } from './lib/env.js';
import { connectDB } from './lib/db.js';






const app = express();

const __dirname = path.resolve();

// console.log('Environment Variable PORT:', ENV.PORT);
// console.log('Environment Variable DB_URL:', ENV.DB_URL);
// console.log("DB_URL =", process.env.DB_URL);


app.get('/', (req, res) => {
    res.status(200).json({ message: 'success from api' })
})

// male our app ready for dployment
if (ENV.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist'))); 
    app.get('/{*any}', (req, res) => {
        res.sendFile(path.join(__dirname,"../frontend","dist","index.html"))
    })
}

connectDB().then(()=>{
    app.listen(ENV.PORT,()=>{
        console.log("server is running on port :",ENV.PORT)
    })
})