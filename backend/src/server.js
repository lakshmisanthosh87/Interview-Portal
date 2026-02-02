import express from 'express';
import { ENV } from './lib/env.js';






const app = express();



console.log('Environment Variable PORT:', ENV.PORT);
console.log('Environment Variable DB_URL:', ENV.DB_URL);

app.get('/', (req, res) => {
    res.status(200).json({ message: 'success from api' })
})

app.listen(ENV.PORT, () => {
    console.log(`Server is running on port ${ENV.PORT}`);
});