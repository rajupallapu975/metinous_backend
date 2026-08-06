const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]:', err.message);
  
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Failed to contact OpenRouter';

  res.status(statusCode).json({
    error: errorMessage
  });
};

module.exports = errorHandler;
