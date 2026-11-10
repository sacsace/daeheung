import { api } from '../client';

type CompanyScoped = { company_id?: number };

const companyParams = (companyId?: number | null): CompanyScoped | undefined => {
  const id = Number(companyId);
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return { company_id: id };
};

const withCompanyBody = <T extends Record<string, unknown>>(
  body: T,
  companyId?: number | null
): T & CompanyScoped => {
  const scoped = companyParams(companyId);
  return scoped ? { ...body, ...scoped } : body;
};

export const inventoryService = {
  getProductCategories: async (companyId?: number | null) => {
    const response = await api.get('/inventory/product-categories', {
      params: companyParams(companyId),
    });
    return response.data;
  },
  createProductCategory: async (name: string, companyId?: number | null) => {
    const response = await api.post(
      '/inventory/product-categories',
      withCompanyBody({ name }, companyId)
    );
    return response.data;
  },
  updateProductCategory: async (id: number, name: string, companyId?: number | null) => {
    const response = await api.put(
      `/inventory/product-categories/${id}`,
      withCompanyBody({ name }, companyId)
    );
    return response.data;
  },
  deleteProductCategory: async (id: number, companyId?: number | null) => {
    const response = await api.delete(`/inventory/product-categories/${id}`, {
      params: companyParams(companyId),
    });
    return response.data;
  },
  getInventoryLocations: async (companyId?: number | null) => {
    const response = await api.get('/inventory/inventory-locations', {
      params: companyParams(companyId),
    });
    return response.data;
  },
  createInventoryLocation: async (name: string, companyId?: number | null) => {
    const response = await api.post(
      '/inventory/inventory-locations',
      withCompanyBody({ name }, companyId)
    );
    return response.data;
  },
  updateInventoryLocation: async (id: number, name: string, companyId?: number | null) => {
    const response = await api.put(
      `/inventory/inventory-locations/${id}`,
      withCompanyBody({ name }, companyId)
    );
    return response.data;
  },
  deleteInventoryLocation: async (id: number, companyId?: number | null) => {
    const response = await api.delete(`/inventory/inventory-locations/${id}`, {
      params: companyParams(companyId),
    });
    return response.data;
  },
  getProductUnits: async (companyId?: number | null) => {
    const response = await api.get('/inventory/product-units', {
      params: companyParams(companyId),
    });
    return response.data;
  },
  createProductUnit: async (name: string, companyId?: number | null) => {
    const response = await api.post(
      '/inventory/product-units',
      withCompanyBody({ name }, companyId)
    );
    return response.data;
  },
  updateProductUnit: async (id: number, name: string, companyId?: number | null) => {
    const response = await api.put(
      `/inventory/product-units/${id}`,
      withCompanyBody({ name }, companyId)
    );
    return response.data;
  },
  deleteProductUnit: async (id: number, companyId?: number | null) => {
    const response = await api.delete(`/inventory/product-units/${id}`, {
      params: companyParams(companyId),
    });
    return response.data;
  },

  getProducts: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/products', { params });
    return response.data;
  },

  getProduct: async (id: number, companyId?: number | null) => {
    const response = await api.get(`/inventory/products/${id}`, {
      params: companyParams(companyId),
    });
    return response.data;
  },

  uploadProductImage: async (file: File, companyId?: number | null) => {
    const formData = new FormData();
    formData.append('file', file);
    const scoped = companyParams(companyId);
    if (scoped) formData.append('company_id', String(scoped.company_id));
    const response = await api.post('/inventory/products/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: scoped,
    });
    return response.data;
  },

  createProduct: async (productData: Record<string, unknown>, companyId?: number | null) => {
    const response = await api.post(
      '/inventory/products',
      withCompanyBody(productData, companyId)
    );
    return response.data;
  },

  updateProduct: async (
    id: number,
    productData: Record<string, unknown>,
    companyId?: number | null
  ) => {
    const response = await api.put(
      `/inventory/products/${id}`,
      withCompanyBody(productData, companyId)
    );
    return response.data;
  },

  deleteProduct: async (id: number, companyId?: number | null) => {
    const response = await api.delete(`/inventory/products/${id}`, {
      params: companyParams(companyId),
    });
    return response.data;
  },

  getInventoryReport: async (companyId?: number | null) => {
    const response = await api.get('/inventory/report', {
      params: companyParams(companyId),
    });
    return response.data;
  },

  getInventoryTransactions: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/transactions', { params });
    return response.data;
  },

  stockIn: async (stockData: Record<string, unknown>, companyId?: number | null) => {
    const response = await api.post('/inventory/stock-in', withCompanyBody(stockData, companyId));
    return response.data;
  },

  stockOut: async (stockData: Record<string, unknown>, companyId?: number | null) => {
    const response = await api.post('/inventory/stock-out', withCompanyBody(stockData, companyId));
    return response.data;
  },

  adjustStock: async (adjustData: Record<string, unknown>, companyId?: number | null) => {
    const response = await api.post(
      '/inventory/adjust-stock',
      withCompanyBody(adjustData, companyId)
    );
    return response.data;
  },

  downloadProductExcelSample: async (companyId?: number | null): Promise<Blob> => {
    const response = await api.get('/inventory/products/excel/sample', {
      responseType: 'blob',
      params: companyParams(companyId),
    });
    return response.data;
  },

  bulkUpdateProductsFromExcel: async (file: File, companyId?: number | null) => {
    const formData = new FormData();
    formData.append('file', file);
    const scoped = companyParams(companyId);
    if (scoped) formData.append('company_id', String(scoped.company_id));
    const response = await api.post('/inventory/products/excel/bulk-update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: scoped,
    });
    return response.data;
  },
};
