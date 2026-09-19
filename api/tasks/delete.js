const db=require('../_db');module.exports=async(req,res)=>{try{await db.query('UPDATE tasks SET deleted=1 WHERE id=?',[req.body.id]);res.json({ok:true})}catch(e){res.status(500).send(e.message)}};
