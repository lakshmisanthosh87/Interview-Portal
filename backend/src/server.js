import express from 'express';
import path from 'path';
import { ENV } from './lib/env.js';






const app = express();

const __dirname = path.resolve();

// console.log('Environment Variable PORT:', ENV.PORT);
// console.log('Environment Variable DB_URL:', ENV.DB_URL);

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

app.listen(ENV.PORT, () => {
    console.log(`Server is running on port ${ENV.PORT}`);
});