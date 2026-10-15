const express = require('express');
const { ingestPacket } = require('../services/ingest.service');

module.exports = function ingestRoutes(db){
    const router = express.Router();

    router.post('/', (req, res, next) => {
        try{
            const result = ingestPacket(db, req.body);
            const status = result.duplicate ? 200 : 201;
            res.status(status).json({
                duplicate: result.duplicate,
                readingId: result.readingId,
                deviceId: result.packet.deviceId,
                alerts: result.alerts || [],
            });
        }
        catch(err){
            next(err);
        }
    });

    return router;
}