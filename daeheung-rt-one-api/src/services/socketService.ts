import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { isCorsAllowLanEnabled, isPrivateLanHttpOrigin } from '../utils/corsPrivateLan';
import { isMvsNotifierClient } from '../constants/authClients';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    userid: string;
    tenant_id: number;
    company_id: number;
  };
}

interface JwtSocketPayload {
  userId: number;
  userid?: string;
  tenantId?: number;
  companyId?: number;
  sv?: number;
  client?: string;
}

class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<number, string> = new Map();

  constructor(server: HTTPServer) {
    const mergeList = (process.env.CORS_ORIGIN || '')
      .split(',')
      .concat((process.env.WS_CORS_ORIGIN || '').split(','))
      .map((o) => o.trim())
      .filter(Boolean);
    const allowedOrigins =
      mergeList.length > 0 ? mergeList : ['http://localhost:3000'];

    const isDev = process.env.NODE_ENV === 'development';

    this.io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (isDev) {
            return callback(null, true);
          }
          if (!origin) {
            return callback(null, true);
          }
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          if (isCorsAllowLanEnabled() && isPrivateLanHttpOrigin(origin)) {
            return callback(null, true);
          }
          return callback(null, false);
        },
        methods: ['GET', 'POST'],
        credentials: true
      },
      maxHttpBufferSize: 1e6
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      const authToken = socket.handshake.auth?.token;
      const bearerHeader = socket.handshake.headers?.authorization;
      const bearerToken =
        typeof bearerHeader === 'string' && bearerHeader.startsWith('Bearer ')
          ? bearerHeader.split(' ')[1]
          : undefined;
      const token = typeof authToken === 'string' && authToken.trim() ? authToken.trim() : bearerToken;

      if (!token) {
        return next(new Error('인증 토큰이 필요합니다.'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('서버 JWT 설정이 누락되었습니다.'));
      }

      try {
        const decoded = jwt.verify(token, secret) as JwtSocketPayload;
        if (!decoded?.userId || typeof decoded.userId !== 'number') {
          return next(new Error('유효하지 않은 토큰 payload입니다.'));
        }

        const user = await (User as any).findByPk(decoded.userId, {
          attributes: ['id', 'status', 'session_version'],
        });
        if (!user || user.status !== 'active') {
          return next(new Error('유효하지 않은 사용자입니다.'));
        }
        if (
          !isMvsNotifierClient(decoded.client) &&
          Number(user.session_version ?? 0) !== Number(decoded.sv ?? 0)
        ) {
          return next(new Error('SESSION_SUPERSEDED'));
        }

        socket.user = {
          id: decoded.userId,
          userid: decoded.userid || `user-${decoded.userId}`,
          tenant_id: Number(decoded.tenantId || 0),
          company_id: Number(decoded.companyId || 0)
        };
        return next();
      } catch {
        return next(new Error('유효하지 않은 소켓 인증 토큰입니다.'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      if (socket.user) {
        this.connectedUsers.set(socket.user.id, socket.id);
      }

      // 사용자별 알림 구독
      socket.on('subscribe_notifications', (_data) => {
        if (socket.user) {
          socket.join(`user_${socket.user.id}`);
          if (socket.user.tenant_id > 0) {
            socket.join(`tenant_${socket.user.tenant_id}`);
          }
        }
      });

      // 채팅방 참여
      socket.on('join_room', (roomId: string) => {
        socket.join(`room_${roomId}`);
        socket.to(`room_${roomId}`).emit('user_joined', {
          user: socket.user?.userid,
          message: `${socket.user?.userid}님이 참여했습니다.`
        });
      });

      // 채팅 메시지 전송
      socket.on('send_message', (data) => {
        const { roomId, message, type = 'text' } = data;
        socket.to(`room_${roomId}`).emit('new_message', {
          id: Date.now(),
          user: socket.user?.userid,
          message,
          type,
          timestamp: new Date().toISOString()
        });
      });

      // 연결 해제
      socket.on('disconnect', () => {
        if (socket.user) {
          this.connectedUsers.delete(socket.user.id);
        }
      });
    });
  }

  // 사용자에게 알림 전송
  sendNotificationToUser(userId: number, notification: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', notification);
    }
  }

  // 테넌트 전체에 알림 전송
  sendNotificationToTenant(tenantId: number, notification: any) {
    this.io.to(`tenant_${tenantId}`).emit('notification', notification);
  }

  // 채팅방에 메시지 전송
  sendMessageToRoom(roomId: string, message: any) {
    this.io.to(`room_${roomId}`).emit('new_message', message);
  }

  // 시스템 알림 전송
  sendSystemNotification(notification: any) {
    this.io.emit('system_notification', notification);
  }

  getIO() {
    return this.io;
  }
}

export default SocketService;
