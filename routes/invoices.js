/** Routes for invoices. */


const express = require("express");
const ExpressError = require("../expressError")
const db = require("../db");

let router = new express.Router();


/** GET / => list of invoices.
 *
 * =>  {invoices: [{id, comp_code}, ...]}
 *
 * */

router.get("/", async function (req, res, next) {
  try {
    const result = await db.query(
          `SELECT id, comp_code
           FROM invoices 
           ORDER BY id`
    );

    return res.json({"invoices": result.rows});
  }

  catch (err) {
    return next(err);
  }
});


/** GET /[id] => detail on invoice
 *
 * =>  {invoices: {id,
 *                amt,
 *                paid,
 *                add_date,
 *                paid_date,
 *                company: {code, name, description}}}
 *
 * */

router.get("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;

    const result = await db.query(
          `SELECT i.id, 
                  i.comp_code, 
                  i.amt, 
                  i.paid, 
                  i.add_date, 
                  i.paid_date, 
                  c.name, 
                  c.description 
           FROM invoices AS i
             INNER JOIN companies AS c ON (i.comp_code = c.code)  
           WHERE id = $1`,
        [id]);

    if (result.rows.length === 0) {
      throw new ExpressError(`No such invoice: ${id}`,404);
    }

    const data = result.rows[0];
    const invoice = {
      id: data.id,
      company: {
        code: data.comp_code,
        name: data.name,
        description: data.description,
      },
      amt: data.amt,
      paid: data.paid,
      add_date: data.add_date,
      paid_date: data.paid_date,
    };

    return res.json({"invoice": invoice});
  }

  catch (err) {
    return next(err);
  }
});


/** POST / => add new invoice
 *
 * {comp_code, amt}  =>  {id, comp_code, amt, paid, add_date, paid_date}
 *
 * */

router.post("/", async function (req, res, next) {
  try {
    let {comp_code, amt} = req.body;

    const result = await db.query(
          `INSERT INTO invoices (comp_code, amt) 
           VALUES ($1, $2) 
           RETURNING id, comp_code, amt, paid, add_date, paid_date`,
        [comp_code, amt]);

    return res.json({"invoice": result.rows[0]});
  }

  catch (err) {
    return next(err);
  }
});


/** PUT /[code] => update invoice
 *
 * {amt, paid}  =>  {id, comp_code, amt, paid, add_date, paid_date}
 *
 * If paying unpaid invoice, set paid_date; if marking as unpaid, clear paid_date.
 * */

const { Client } = require('pg');
const client = new Client({
  // Your connection details
});

router.put('/:id', async (req, res) => {
  const { amt, paid } = req.body;
  const paid_date = paid ? new Date().toISOString() : null;

  try {
    const result = await db.query(
      `UPDATE invoices
       SET amt = $1, paid = $2, paid_date = $3
       WHERE id = $4
       RETURNING *`,
      [amt, paid, paid_date, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ invoice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/** DELETE /[code] => delete invoice
 *
 * => {status: "deleted"}
 *
 */

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;

    const result = await db.query(
          `DELETE FROM invoices
           WHERE id = $1
           RETURNING id`,
        [id]);

    if (result.rows.length === 0) {
      throw new ExpressError(`No such invoice: ${id}`, 404);
    }

    return res.json({"status": "deleted"});
  }

  catch (err) {
    return next(err);
  }
});


module.exports = router;
