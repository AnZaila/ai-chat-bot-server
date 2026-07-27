const express = require("express");

const conversationController = require("../controllers/conversationController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(requireAuth);

router.get("/", conversationController.list);
router.post("/", conversationController.create);
router.get("/:id", conversationController.detail);
router.delete("/:id", conversationController.remove);

module.exports = router;
