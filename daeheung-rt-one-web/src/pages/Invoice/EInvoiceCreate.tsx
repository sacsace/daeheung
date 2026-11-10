import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar } from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsPageRootSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface EInvoiceItem {
  id: number;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  hsnCode: string;
  taxableValue: number;
  discountAmount: number;
  discountPercentage: number;
  taxAmount: number;
  taxRate: number;
}

interface EInvoice {
  id: number;
  invoiceNumber: string;
  irn: string;
  qrCode: string;
  ackNo: string;
  ackDate: string;
  customerId: number;
  customerName: string;
  customerGstin: string;
  customerAddress: string;
  customerEmail: string;
  customerPhone: string;
  customerState: string;
  customerStateCode: string;
  companyGstin: string;
  companyName: string;
  companyAddress: string;
  companyState: string;
  companyStateCode: string;
  invoiceDate: string;
  dueDate: string;
  supplyType: 'interstate' | 'intrastate';
  reverseCharge: boolean;
  items: EInvoiceItem[];
  subtotal: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  totalTax: number;
  totalAmount: number;
  totalDiscount: number;
  roundOffAmount: number;
  status: 'draft' | 'generated' | 'sent' | 'cancelled' | 'acknowledged';
  createdAt: string;
  updatedAt: string;
}

const EInvoiceCreate: React.FC = () => {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const txt = (ko: string, en: string) => (i18n.language?.startsWith('en') ? en : ko);
  const [activeStep, setActiveStep] = useState(0);
  const [invoice, setInvoice] = useState<Partial<EInvoice>>({
    invoiceNumber: '',
    customerName: '',
    customerGstin: '',
    customerAddress: '',
    customerEmail: '',
    customerPhone: '',
    companyGstin: '29ABCDE1234F1Z5',
    companyName: 'MVS Solutions',
    companyAddress: '123 Business Park, Bangalore, Karnataka 560001',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [],
    subtotal: 0,
    totalTax: 0,
    totalAmount: 0,
    status: 'draft'
  });
  const [items, setItems] = useState<EInvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EInvoiceItem | null>(null);

  const steps = [
    txt('고객 정보', 'Customer'),
    txt('상품/서비스', 'Items'),
    txt('세금 계산', 'Tax'),
    txt('검토 및 생성', 'Review'),
  ];

  const sectionCardSx = {
    borderRadius: '8px',
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.03) : '#FFFFFF',
    boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)' };

  useEffect(() => {
    calculateTotals();
  }, [items]);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const totalAmount = subtotal + totalTax;

    setInvoice(prev => ({
      ...prev,
      subtotal,
      totalTax,
      totalAmount
    }));
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setOpenItemDialog(true);
  };

  const handleEditItem = (item: EInvoiceItem) => {
    setSelectedItem(item);
    setOpenItemDialog(true);
  };

  const handleDeleteItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveItem = (itemData: Omit<EInvoiceItem, 'id'>) => {
    if (selectedItem) {
      setItems(prev => prev.map(item => 
        item.id === selectedItem.id 
          ? { ...itemData, id: selectedItem.id }
          : item
      ));
    } else {
      const newItem: EInvoiceItem = {
        ...itemData,
        id: Date.now()
      };
      setItems(prev => [...prev, newItem]);
    }
    setOpenItemDialog(false);
  };

  const handleGenerateInvoice = async () => {
    setLoading(true);
    try {
      setSuccess('E-Invoice가 성공적으로 생성되었습니다.');
    } catch {
      setError('E-Invoice 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerInfo = () => (
    <Card elevation={0} sx={sectionCardSx}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{txt('고객 정보', 'Customer Information')}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="고객명"
              value={invoice.customerName || ''}
              onChange={(e) => setInvoice(prev => ({ ...prev, customerName: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="고객 GSTIN"
              value={invoice.customerGstin || ''}
              onChange={(e) => setInvoice(prev => ({ ...prev, customerGstin: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="고객 주소"
              multiline
              rows={3}
              value={invoice.customerAddress || ''}
              onChange={(e) => setInvoice(prev => ({ ...prev, customerAddress: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="이메일"
              type="email"
              value={invoice.customerEmail || ''}
              onChange={(e) => setInvoice(prev => ({ ...prev, customerEmail: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="전화번호"
              value={invoice.customerPhone || ''}
              onChange={(e) => setInvoice(prev => ({ ...prev, customerPhone: e.target.value }))}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderItems = () => (
    <Card elevation={0} sx={sectionCardSx}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{txt('상품/서비스', 'Items')}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            {txt('항목 추가', 'Add Item')}
          </Button>
        </Box>
        
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: '8px',
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            overflow: 'hidden' }}
        >
          <Table>
            <TableHead
              sx={{
                bgcolor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.03)' : alpha(theme.palette.common.white, 0.05),
                '& .MuiTableCell-head': { fontWeight: 700, fontSize: '0.78rem' } }}
            >
              <TableRow>
                <TableCell>{txt('상품명', 'Item')}</TableCell>
                <TableCell>{txt('수량', 'Qty')}</TableCell>
                <TableCell>{txt('단가', 'Unit Price')}</TableCell>
                <TableCell>{txt('금액', 'Amount')}</TableCell>
                <TableCell>{txt('세율', 'Tax Rate')}</TableCell>
                <TableCell>{txt('세금', 'Tax')}</TableCell>
                <TableCell>{txt('작업', 'Action')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>Rs. {item.unitPrice.toLocaleString()}</TableCell>
                  <TableCell>Rs. {item.totalPrice.toLocaleString()}</TableCell>
                  <TableCell>{item.taxRate}%</TableCell>
                  <TableCell>Rs. {item.taxAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEditItem(item)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteItem(item.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const renderTaxCalculation = () => (
    <Card elevation={0} sx={sectionCardSx}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{txt('세금 계산', 'Tax Calculation')}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.04) : 'grey.50', borderRadius: 2 }}>
              <Typography variant="body1" gutterBottom>
                {txt('공급가액', 'Subtotal')}: Rs. {invoice.subtotal?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {txt('총 세금', 'Total Tax')}: Rs. {invoice.totalTax?.toLocaleString() || 0}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" color="primary.main">
                {txt('총 금액', 'Grand Total')}: Rs. {invoice.totalAmount?.toLocaleString() || 0}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="body2" color="text.secondary">
              {txt('GST 규정에 따라 자동으로 세금이 계산됩니다.', 'Tax values are calculated automatically based on GST rules.')}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderReview = () => (
    <Card elevation={0} sx={sectionCardSx}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{txt('E-Invoice 검토', 'E-Invoice Review')}</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle1" gutterBottom>{txt('회사 정보', 'Company')}</Typography>
            <Typography variant="body2">{invoice.companyName}</Typography>
            <Typography variant="body2">GSTIN: {invoice.companyGstin}</Typography>
            <Typography variant="body2">{invoice.companyAddress}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle1" gutterBottom>{txt('고객 정보', 'Customer')}</Typography>
            <Typography variant="body2">{invoice.customerName}</Typography>
            <Typography variant="body2">GSTIN: {invoice.customerGstin}</Typography>
            <Typography variant="body2">{invoice.customerAddress}</Typography>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" gutterBottom>{txt('인보이스 요약', 'Invoice Summary')}</Typography>
            <Typography variant="body2">{txt('인보이스 번호', 'Invoice Number')}: {invoice.invoiceNumber}</Typography>
            <Typography variant="body2">{txt('인보이스 날짜', 'Invoice Date')}: {invoice.invoiceDate}</Typography>
            <Typography variant="body2">{txt('총 금액', 'Grand Total')}: Rs. {invoice.totalAmount?.toLocaleString() || 0}</Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        ...mvsPageRootSx,
        px: { xs: 0, sm: 0.5, md: 1 } }}
    >
      <DaeheungPageHeader
        title={txt('E-Invoice 생성', 'Create E-Invoice')}
        icon={<ReceiptIcon />}
        actions={
          <>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            disabled={activeStep < 3}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
          >
            {txt('미리보기', 'Preview')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={activeStep < 3}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
          >
            {txt('PDF 다운로드', 'Download PDF')}
          </Button>
          </>
        }
      />

      <Card elevation={0} sx={{ ...sectionCardSx, mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Box sx={{ mb: 3 }}>
        {activeStep === 0 && renderCustomerInfo()}
        {activeStep === 1 && renderItems()}
        {activeStep === 2 && renderTaxCalculation()}
        {activeStep === 3 && renderReview()}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
        >
          {txt('이전', 'Back')}
        </Button>
        <Box>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleGenerateInvoice}
              disabled={loading}
              startIcon={<SendIcon />}
              sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700, boxShadow: 'none' }}
            >
              {txt('E-Invoice 생성', 'Generate E-Invoice')}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700, boxShadow: 'none' }}
            >
              {txt('다음', 'Next')}
            </Button>
          )}
        </Box>
      </Box>

      {/* 항목 추가/수정 다이얼로그 */}
      <ItemDialog
        open={openItemDialog}
        onClose={() => setOpenItemDialog(false)}
        onSave={handleSaveItem}
        item={selectedItem}
      />

      {/* 스낵바 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// 항목 추가/수정 다이얼로그 컴포넌트
interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<EInvoiceItem, 'id'>) => void;
  item: EInvoiceItem | null;
}

const ItemDialog: React.FC<ItemDialogProps> = ({ open, onClose, onSave, item }) => {
  const [formData, setFormData] = useState({
    itemName: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
    taxRate: 18,
    hsnCode: ''
  });

  useEffect(() => {
    if (item) {
      setFormData({
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        hsnCode: item.hsnCode
      });
    } else {
      setFormData({
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 18,
        hsnCode: ''
      });
    }
  }, [item]);

  const handleSave = () => {
    const totalPrice = formData.quantity * formData.unitPrice;
    const taxAmount = (totalPrice * formData.taxRate) / 100;
    const taxableValue = totalPrice;
    const cgstRate = formData.taxRate / 2; // 기본적으로 CGST/SGST로 설정
    const sgstRate = formData.taxRate / 2;
    const igstRate = 0; // IGST는 별도 설정 필요
    const cessRate = 0;
    const cgstAmount = (taxableValue * cgstRate) / 100;
    const sgstAmount = (taxableValue * sgstRate) / 100;
    const igstAmount = (taxableValue * igstRate) / 100;
    const cessAmount = (taxableValue * cessRate) / 100;
    const discountAmount = 0;
    const discountPercentage = 0;

    onSave({
      itemName: formData.itemName,
      description: formData.description,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      totalPrice,
      taxRate: formData.taxRate,
      taxAmount,
      hsnCode: formData.hsnCode,
      taxableValue,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      cessRate,
      cessAmount,
      discountAmount,
      discountPercentage
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {item ? '항목 수정' : '항목 추가'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="상품명"
              value={formData.itemName}
              onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="설명"
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              label="수량"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              label="단가"
              type="number"
              value={formData.unitPrice}
              onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              label="세율 (%)"
              type="number"
              value={formData.taxRate}
              onChange={(e) => setFormData(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
            />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField
              fullWidth
              label="HSN 코드"
              value={formData.hsnCode}
              onChange={(e) => setFormData(prev => ({ ...prev, hsnCode: e.target.value }))}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSave}>
          {item ? '수정' : '추가'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EInvoiceCreate;
