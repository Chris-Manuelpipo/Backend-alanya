const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.type === 'validation') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  if (err.code === 'ER_NO_REFERENCED_2') {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  res.status(500).json({ error: 'Internal server error' });
};

module.exports = errorHandler;