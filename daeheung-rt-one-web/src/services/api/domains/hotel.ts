import { api } from '../client';

export const roomBookingService = {
  getRoomBookings: async (params?: { room_id?: number; user_id?: number; status?: string; check_in_date?: string; check_out_date?: string }) => {
    const response = await api.get('/work/room-bookings', { params });
    return response.data;
  },

  // ?�의???�약 ?�세 조회
  getRoomBooking: async (id: number) => {
    const response = await api.get(`/work/room-bookings/${id}`);
    return response.data;
  },

  // ?�의???�약 ?�성
  createRoomBooking: async (data: any) => {
    const response = await api.post('/work/room-bookings', data);
    return response.data;
  },

  // ?�의???�약 ?�정
  updateRoomBooking: async (id: number, data: any) => {
    const response = await api.put(`/work/room-bookings/${id}`, data);
    return response.data;
  },

  // ?�의???�약 ??��
  deleteRoomBooking: async (id: number) => {
    const response = await api.delete(`/work/room-bookings/${id}`);
    return response.data;
  },

  // ?�의???�약 ?�인
  confirmRoomBooking: async (id: number) => {
    const response = await api.post(`/work/room-bookings/${id}/confirm`);
    return response.data;
  },

  // ?�의???�약 취소
  cancelRoomBooking: async (id: number) => {
    const response = await api.post(`/work/room-bookings/${id}/cancel`);
    return response.data;
  }
};

// 객실 ?�형 API ?�비??
export const roomTypeService = {
  getRoomTypes: async (params?: { status?: string }) => {
    const response = await api.get('/work/room-types', { params });
    return response.data;
  },
  createRoomType: async (data: any) => {
    const response = await api.post('/work/room-types', data);
    return response.data;
  },
  updateRoomType: async (id: number, data: any) => {
    const response = await api.put(`/work/room-types/${id}`, data);
    return response.data;
  },
  deleteRoomType: async (id: number) => {
    const response = await api.delete(`/work/room-types/${id}`);
    return response.data;
  },
};

export const roomTypeRoomService = {
  getRoomTypeRooms: async (params?: { room_type_id?: number }) => {
    const response = await api.get('/work/room-type-rooms', { params });
    return response.data;
  },
  upsertRoomTypeRoom: async (data: { room_type_id: number; room_number: string; room_name?: string }) => {
    const response = await api.put('/work/room-type-rooms', data);
    return response.data;
  },
};

// ?�무 보고??API ?�비??
