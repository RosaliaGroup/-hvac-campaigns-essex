import bcrypt from 'bcryptjs'; 
import mysql from 'mysql2/promise'; 
import dotenv from 'dotenv'; 
dotenv.config(); 
const conn = await mysql.createConnection(process.env.DATABASE_URL); 
const hash = await bcrypt.hash('Mechanical2026!', 12); 
const [ex] = await conn.execute('SELECT id FROM teamMembers WHERE email = ?', ['sales@mechanicalenterprise.com']); 
if (ex.length  { 
  await conn.execute('UPDATE teamMembers SET passwordHash=?, status=??, role=??, name=?? WHERE email=??', [hash, 'active', 'admin', 'Ana Haynes', 'sales@mechanicalenterprise.com']); 
} else { 
  await conn.execute('INSERT INTO teamMembers (email,name,role,passwordHash,status,createdAt) VALUES (?,?,?,?,?,NOW())', ['sales@mechanicalenterprise.com','Ana Haynes','admin',hash,'active']); 
} 
console.log('Done! Login: sales@mechanicalenterprise.com / Mechanical2026!'); 
await conn.end(); 
