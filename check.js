const db = require('./config/db'); db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'donations\'').then(res=>console.log(res.rows));
