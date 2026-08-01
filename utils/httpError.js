function createHttpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.isOperational = true;

  return error;
}

module.exports = {
  createHttpError,
};
