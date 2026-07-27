const {
  createConversation,
  deleteConversation,
  getConversationWithMessages,
  listConversations,
  toConversationDto,
} = require("../services/conversationService");
const { resolveModelName } = require("./chatController");

async function list(req, res, next) {
  try {
    res.json({
      conversations: await listConversations(req.user.id),
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const conversation = await createConversation({
      userId: req.user.id,
      model: resolveModelName(req.body.model),
      title: typeof req.body.title === "string" ? req.body.title.trim() : "",
    });

    res.status(201).json({
      conversation: toConversationDto(conversation),
    });
  } catch (error) {
    next(error);
  }
}

async function detail(req, res, next) {
  try {
    res.json({
      conversation: await getConversationWithMessages(req.user.id, req.params.id),
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    await deleteConversation(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  create,
  detail,
  list,
  remove,
};
