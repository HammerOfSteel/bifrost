import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Verify JWT token from Authorization header
 * Header format: Authorization: Bearer {token}
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'MISSING_TOKEN',
      message: 'Missing or invalid Authorization header'
    });
  }
  
  const token = authHeader.substring(7); // Remove "Bearer "
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token',
      details: error.message
    });
  }
}

/**
 * Check if user is admin
 * Must be used AFTER authenticate middleware
 */
export function authorize(role = 'admin') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'MISSING_USER',
        message: 'User not authenticated'
      });
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `This action requires '${role}' role`
      });
    }
    
    next();
  };
}

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.is_admin ? 'admin' : 'user'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export default {
  authenticate,
  authorize,
  generateToken,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
