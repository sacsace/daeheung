import sequelize from '../config/database';
import { ensureUserEmploymentTypeEnum } from '../db/ensureUserEmploymentTypeEnum';
import User from './User';
import Menu from './Menu';
import UserPermission from './UserPermission';
import Company from './Company';
import LoginInfo from './LoginInfo';
import LoginInfoTab from './LoginInfoTab';
import LoginLog from './LoginLog';
import Tenant from './Tenant';
import Department from './Department';
import Position from './Position';
import Customer from './Customer';
import Contract from './Contract';
import ContractType from './ContractType';
import SupportTicket from './SupportTicket';
import SupportResponse from './SupportResponse';
import Invoice from './Invoice';
import InvoiceItem from './InvoiceItem';
import Product from './Product';
import ProductCategory from './ProductCategory';
import ProductUnit from './ProductUnit';
import InventoryLocation from './InventoryLocation';
import Project from './Project';
import ProjectMember from './ProjectMember';
import ProjectSchedule from './ProjectSchedule';
import ProjectTask from './ProjectTask';
import ProjectTaskAssignee from './ProjectTaskAssignee';
import ProjectActivity from './ProjectActivity';
import ProjectTaskComment from './ProjectTaskComment';
import Payroll from './Payroll';
import PayrollBonus from './PayrollBonus';
import PayrollPeriodLock from './PayrollPeriodLock';
import PayslipDelivery from './PayslipDelivery';
import InventoryTransaction from './InventoryTransaction';
import CompanyGstNumber from './CompanyGstNumber';
import Partner from './Partner';
import PartnerGstNumber from './PartnerGstNumber';
import Attendance from './Attendance';
import Vacation from './Vacation';
import Performance from './Performance';
import WorkStatistic from './WorkStatistic';
import Approval from './Approval';
import Quotation from './Quotation';
import RoomBooking from './RoomBooking';
import RoomType from './RoomType';
import RoomTypeRoom from './RoomTypeRoom';
import WorkReport from './WorkReport';
import EWayBill from './EWayBill';
import EWayBillItem from './EWayBillItem';
import Notice from './Notice';
import NoticePoll from './NoticePoll';
import NoticePollOption from './NoticePollOption';
import NoticePollVote from './NoticePollVote';
import NoticeView from './NoticeView';
import CompanyPolicy from './CompanyPolicy';
import CompanyPolicyRevision from './CompanyPolicyRevision';
import ExpenseReport from './ExpenseReport';
import Budget from './Budget';
import Asset from './Asset';
import AutoVoucher from './AutoVoucher';
import AutoVoucherRule from './AutoVoucherRule';
import AutoVoucherAuditLog from './AutoVoucherAuditLog';
import AccountingBrainAuditLog from './AccountingBrainAuditLog';
import AiLearningCorrection from './AiLearningCorrection';
import GlAccount from './GlAccount';
import GlVoucher from './GlVoucher';
import GlVoucherLine from './GlVoucherLine';
import AcVoucherType from './AcVoucherType';
import AcTransactionItem from './AcTransactionItem';
import AcGstCode from './AcGstCode';
import AcTdsCode from './AcTdsCode';
import AcBankAccount from './AcBankAccount';
import AcFinancialYear from './AcFinancialYear';
import AcVoucherAuditLog from './AcVoucherAuditLog';
import AcImportTemplate from './AcImportTemplate';
import AcImportBatch from './AcImportBatch';
import AcImportSourceDocument from './AcImportSourceDocument';
import AcImportBatchDocument from './AcImportBatchDocument';
import AcImportMapping from './AcImportMapping';
import AcImportIssue from './AcImportIssue';
import WorkBoard from './WorkBoard';
import WorkBoardList from './WorkBoardList';
import WorkBoardCard from './WorkBoardCard';
import WorkBoardCardComment from './WorkBoardCardComment';
import WorkBoardMember from './WorkBoardMember';
import RecurringTaskTemplate from './RecurringTaskTemplate';
import RecurringBoardClient from './RecurringBoardClient';
import RecurringTaskAssignment from './RecurringTaskAssignment';
import RecurringTaskInstance from './RecurringTaskInstance';
import WorkAssignee from './WorkAssignee';
import WorkAssigneeItem from './WorkAssigneeItem';
import ApprovalType from './ApprovalType';
import CompanyCalendarSchedule from './CompanyCalendarSchedule';
import WebAuthnCredential from './WebAuthnCredential';
import EmploymentContractTemplate from './EmploymentContractTemplate';
import EmploymentContract from './EmploymentContract';
import EmploymentContractSignature from './EmploymentContractSignature';
import EmploymentContractEsignSession from './EmploymentContractEsignSession';
import EmploymentContractAuditLog from './EmploymentContractAuditLog';

// 관계 설정
// 테넌트 관계
(Tenant as any).hasMany(User, { foreignKey: 'tenant_id', as: 'users' });
(User as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Tenant as any).hasMany(Department, { foreignKey: 'tenant_id', as: 'departments' });
(Department as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(Department, { foreignKey: 'company_id', as: 'departments' });
(Department as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).belongsTo(Department, { foreignKey: 'department_id', as: 'departmentEntity' });
(Department as any).hasMany(User, { foreignKey: 'department_id', as: 'users' });

(Tenant as any).hasMany(Position, { foreignKey: 'tenant_id', as: 'positions' });
(Position as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(Position, { foreignKey: 'company_id', as: 'positions' });
(Position as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).belongsTo(Position, { foreignKey: 'position_id', as: 'positionEntity' });
(Position as any).hasMany(User, { foreignKey: 'position_id', as: 'users' });

(Tenant as any).hasMany(Company, { foreignKey: 'tenant_id', as: 'companies' });
(Company as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Tenant as any).hasMany(Menu, { foreignKey: 'tenant_id', as: 'menus' });
Menu.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// 회사 관계
(Company as any).hasMany(User, { foreignKey: 'company_id', as: 'users' });
(User as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 로그인 정보 탭 / 행 관계
(Company as any).hasMany(LoginInfoTab, { foreignKey: 'company_id', as: 'loginInfoTabs' });
LoginInfoTab.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(Tenant as any).hasMany(LoginInfoTab, { foreignKey: 'tenant_id', as: 'loginInfoTabs' });
LoginInfoTab.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(LoginInfo, { foreignKey: 'company_id', as: 'loginInfos' });
(Tenant as any).hasMany(LoginInfo, { foreignKey: 'tenant_id', as: 'loginInfos' });
LoginInfo.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
LoginInfo.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
LoginInfo.belongsTo(LoginInfoTab, { foreignKey: 'tab_id', as: 'loginInfoTab' });
(LoginInfoTab as any).hasMany(LoginInfo, { foreignKey: 'tab_id', as: 'loginInfos' });
LoginInfo.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
LoginInfo.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// 로그인 로그 관계
(Tenant as any).hasMany(LoginLog, { foreignKey: 'tenant_id', as: 'loginLogs' });
(Company as any).hasMany(LoginLog, { foreignKey: 'company_id', as: 'companyLoginLogs' });
(User as any).hasMany(LoginLog, { foreignKey: 'user_id', as: 'loginLogs' });
LoginLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
LoginLog.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
LoginLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 사용자 권한 관계 설정
(User as any).hasMany(UserPermission, { foreignKey: 'user_id', as: 'permissions' });
UserPermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Menu.hasMany(UserPermission, { foreignKey: 'menu_id', as: 'permissions' });
UserPermission.belongsTo(Menu, { foreignKey: 'menu_id', as: 'menu' });

// 고객 관계
(Tenant as any).hasMany(Customer, { foreignKey: 'tenant_id', as: 'customers' });
(Customer as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Customer, { foreignKey: 'company_id', as: 'customers' });
(Customer as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 계약 관계
(Customer as any).hasMany(Contract, { foreignKey: 'customer_id', as: 'contracts' });
(Contract as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

// 지원 티켓 관계
(Customer as any).hasMany(SupportTicket, { foreignKey: 'customer_id', as: 'supportTickets' });
(SupportTicket as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

(User as any).hasMany(SupportTicket, { foreignKey: 'assigned_to', as: 'assignedTickets' });
(SupportTicket as any).belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });

(SupportTicket as any).hasMany(SupportResponse, { foreignKey: 'ticket_id', as: 'responses' });
(SupportResponse as any).belongsTo(SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });

(User as any).hasMany(SupportResponse, { foreignKey: 'user_id', as: 'supportResponses' });
(SupportResponse as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 인보이스 관계
(Customer as any).hasMany(Invoice, { foreignKey: 'customer_id', as: 'invoices' });
(Invoice as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

(User as any).hasMany(Invoice, { foreignKey: 'created_by', as: 'createdInvoices' });
(Invoice as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(User as any).hasMany(Invoice, { foreignKey: 'approver_user_id', as: 'invoicesPendingApproval' });
(Invoice as any).belongsTo(User, { foreignKey: 'approver_user_id', as: 'approver' });

(Invoice as any).hasMany(InvoiceItem, { foreignKey: 'invoice_id', as: 'items' });
(InvoiceItem as any).belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });

// E-Way Bill 관계
(Tenant as any).hasMany(EWayBill, { foreignKey: 'tenant_id', as: 'ewayBills' });
(EWayBill as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(EWayBill, { foreignKey: 'company_id', as: 'ewayBills' });
(EWayBill as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Invoice as any).hasMany(EWayBill, { foreignKey: 'invoice_id', as: 'ewayBills' });
(EWayBill as any).belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });

(EWayBill as any).hasMany(EWayBillItem, { foreignKey: 'eway_bill_id', as: 'items' });
(EWayBillItem as any).belongsTo(EWayBill, { foreignKey: 'eway_bill_id', as: 'ewayBill' });

(User as any).hasMany(EWayBill, { foreignKey: 'generated_by', as: 'generatedEwayBills' });
(EWayBill as any).belongsTo(User, { foreignKey: 'generated_by', as: 'generator' });

// 제품 관계
(Tenant as any).hasMany(Product, { foreignKey: 'tenant_id', as: 'products' });
(Product as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Product, { foreignKey: 'company_id', as: 'products' });
(Product as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Product, { foreignKey: 'created_by', as: 'createdProducts' });
(Product as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// 프로젝트 관계
(Tenant as any).hasMany(Project, { foreignKey: 'tenant_id', as: 'projects' });
(Project as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Project, { foreignKey: 'company_id', as: 'projects' });
(Project as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Customer as any).hasMany(Project, { foreignKey: 'customer_id', as: 'projects' });
(Project as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

(User as any).hasMany(Project, { foreignKey: 'project_manager', as: 'managedProjects' });
(Project as any).belongsTo(User, { foreignKey: 'project_manager', as: 'manager' });

(User as any).hasMany(Project, { foreignKey: 'created_by', as: 'createdProjects' });
(Project as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(Project as any).hasMany(ProjectMember, { foreignKey: 'project_id', as: 'members' });
(ProjectMember as any).belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
(User as any).hasMany(ProjectMember, { foreignKey: 'user_id', as: 'projectMemberships' });
(ProjectMember as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });
(ProjectMember as any).belongsTo(User, { foreignKey: 'invited_by', as: 'inviter' });

(Project as any).hasMany(ProjectSchedule, { foreignKey: 'project_id', as: 'schedules' });
(ProjectSchedule as any).belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
(ProjectSchedule as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(Project as any).hasMany(ProjectTask, { foreignKey: 'project_id', as: 'tasks' });
(ProjectTask as any).belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
(ProjectTask as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
(ProjectTask as any).belongsTo(User, { foreignKey: 'completed_by', as: 'completer' });
(ProjectTask as any).hasMany(ProjectTaskAssignee, { foreignKey: 'task_id', as: 'assignees' });
(ProjectTaskAssignee as any).belongsTo(ProjectTask, { foreignKey: 'task_id', as: 'task' });
(ProjectTaskAssignee as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });
(User as any).hasMany(ProjectTaskAssignee, { foreignKey: 'user_id', as: 'projectTaskAssignments' });

(ProjectTask as any).hasMany(ProjectTaskComment, { foreignKey: 'task_id', as: 'comments' });
(ProjectTaskComment as any).belongsTo(ProjectTask, { foreignKey: 'task_id', as: 'task' });
(ProjectTaskComment as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });
(User as any).hasMany(ProjectTaskComment, { foreignKey: 'user_id', as: 'projectTaskComments' });
(ProjectTaskComment as any).belongsTo(ProjectTaskComment, {
  foreignKey: 'parent_id',
  as: 'parent',
});
(ProjectTaskComment as any).hasMany(ProjectTaskComment, {
  foreignKey: 'parent_id',
  as: 'replies',
});

(Project as any).hasMany(ProjectActivity, { foreignKey: 'project_id', as: 'activities' });
(ProjectActivity as any).belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
(ProjectActivity as any).belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
(ProjectActivity as any).belongsTo(ProjectTask, { foreignKey: 'task_id', as: 'task' });

// 급여 관계
(Tenant as any).hasMany(Payroll, { foreignKey: 'tenant_id', as: 'payrolls' });
(Payroll as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Payroll, { foreignKey: 'company_id', as: 'payrolls' });
(Payroll as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Payroll, { foreignKey: 'employee_id', as: 'payrolls' });
(Payroll as any).belongsTo(User, { foreignKey: 'employee_id', as: 'employee' });

(User as any).hasMany(Payroll, { foreignKey: 'created_by', as: 'createdPayrolls' });
(Payroll as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(User as any).hasMany(PayrollBonus, { foreignKey: 'employee_id', as: 'payrollBonuses' });
(PayrollBonus as any).belongsTo(User, { foreignKey: 'employee_id', as: 'employee' });
(Company as any).hasMany(PayrollBonus, { foreignKey: 'company_id', as: 'payrollBonuses' });
(PayrollBonus as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 발송된 급여 명세서 (엑셀 업로드 → 메일, MVS 사용자 매칭 시)
(User as any).hasMany(PayslipDelivery, { foreignKey: 'user_id', as: 'payslipDeliveries' });
(PayslipDelivery as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });
(PayslipDelivery as any).belongsTo(User, { foreignKey: 'sent_by', as: 'sender' });
(Company as any).hasMany(PayslipDelivery, { foreignKey: 'company_id', as: 'payslipDeliveries' });
(PayslipDelivery as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 근태 관계
(Tenant as any).hasMany(Attendance, { foreignKey: 'tenant_id', as: 'attendances' });
(Attendance as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Attendance, { foreignKey: 'company_id', as: 'attendances' });
(Attendance as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Attendance, { foreignKey: 'user_id', as: 'attendances' });
(Attendance as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 휴가 관계
(Tenant as any).hasMany(Vacation, { foreignKey: 'tenant_id', as: 'vacations' });
(Vacation as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Vacation, { foreignKey: 'company_id', as: 'vacations' });
(Vacation as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Vacation, { foreignKey: 'user_id', as: 'vacations' });
(Vacation as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

(User as any).hasMany(Vacation, { foreignKey: 'approved_by', as: 'approvedVacations' });
(Vacation as any).belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// 성과 관계
(Tenant as any).hasMany(Performance, { foreignKey: 'tenant_id', as: 'performances' });
(Performance as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Performance, { foreignKey: 'company_id', as: 'performances' });
(Performance as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Performance, { foreignKey: 'user_id', as: 'performances' });
(Performance as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

(User as any).hasMany(Performance, { foreignKey: 'reviewed_by', as: 'reviewedPerformances' });
(Performance as any).belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// 업무 통계 관계
(Tenant as any).hasMany(WorkStatistic, { foreignKey: 'tenant_id', as: 'workStatistics' });
(WorkStatistic as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(WorkStatistic, { foreignKey: 'company_id', as: 'workStatistics' });
(WorkStatistic as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(WorkStatistic, { foreignKey: 'user_id', as: 'workStatistics' });
(WorkStatistic as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 전자 결제 관계
(Tenant as any).hasMany(Approval, { foreignKey: 'tenant_id', as: 'approvals' });
(Approval as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Approval, { foreignKey: 'company_id', as: 'approvals' });
(Approval as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Approval, { foreignKey: 'requester_id', as: 'requestedApprovals' });
(Approval as any).belongsTo(User, { foreignKey: 'requester_id', as: 'requester' });

(User as any).hasMany(Approval, { foreignKey: 'current_approver_id', as: 'pendingApprovals' });
(Approval as any).belongsTo(User, { foreignKey: 'current_approver_id', as: 'currentApprover' });

// 견적서 관계
(Tenant as any).hasMany(Quotation, { foreignKey: 'tenant_id', as: 'quotations' });
(Quotation as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Quotation, { foreignKey: 'company_id', as: 'quotations' });
(Quotation as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Customer as any).hasMany(Quotation, { foreignKey: 'customer_id', as: 'quotations' });
(Quotation as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

(User as any).hasMany(Quotation, { foreignKey: 'created_by', as: 'createdQuotations' });
(Quotation as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(User as any).hasMany(Quotation, { foreignKey: 'approver_user_id', as: 'quotationsPendingApproval' });
(Quotation as any).belongsTo(User, { foreignKey: 'approver_user_id', as: 'approver' });

// 회의실 예약 관계
(Tenant as any).hasMany(RoomBooking, { foreignKey: 'tenant_id', as: 'roomBookings' });
(RoomBooking as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(RoomBooking, { foreignKey: 'company_id', as: 'roomBookings' });
(RoomBooking as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(RoomBooking, { foreignKey: 'user_id', as: 'roomBookings' });
(RoomBooking as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

(User as any).hasMany(RoomBooking, { foreignKey: 'created_by', as: 'createdRoomBookings' });
(RoomBooking as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// 객실 유형 관계
(Tenant as any).hasMany(RoomType, { foreignKey: 'tenant_id', as: 'roomTypes' });
RoomType.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(RoomType, { foreignKey: 'company_id', as: 'roomTypes' });
RoomType.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(RoomType, { foreignKey: 'created_by', as: 'createdRoomTypes' });
RoomType.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// 객실 유형-호실 관계
(RoomType as any).hasMany(RoomTypeRoom, { foreignKey: 'room_type_id', as: 'rooms' });
(RoomTypeRoom as any).belongsTo(RoomType, { foreignKey: 'room_type_id', as: 'roomType' });

// 업무 보고서 관계
(Tenant as any).hasMany(WorkReport, { foreignKey: 'tenant_id', as: 'workReports' });
(WorkReport as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(WorkReport, { foreignKey: 'company_id', as: 'workReports' });
(WorkReport as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(WorkReport, { foreignKey: 'author_id', as: 'workReports' });
(WorkReport as any).belongsTo(User, { foreignKey: 'author_id', as: 'author' });

(User as any).hasMany(WorkReport, { foreignKey: 'reviewer_id', as: 'reviewedWorkReports' });
(WorkReport as any).belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });
(User as any).hasMany(WorkReport, { foreignKey: 'recipient_id', as: 'receivedWorkReports' });
(WorkReport as any).belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });

// 재고 거래 관계
(Tenant as any).hasMany(InventoryTransaction, { foreignKey: 'tenant_id', as: 'inventoryTransactions' });
(InventoryTransaction as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(InventoryTransaction, { foreignKey: 'company_id', as: 'inventoryTransactions' });
(InventoryTransaction as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

Product.hasMany(InventoryTransaction, { foreignKey: 'product_id', as: 'transactions' });
(InventoryTransaction as any).belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

(User as any).hasMany(InventoryTransaction, { foreignKey: 'created_by', as: 'createdInventoryTransactions' });
(InventoryTransaction as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// 공지사항 관계
(Tenant as any).hasMany(Notice, { foreignKey: 'tenant_id', as: 'notices' });
(Notice as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Notice, { foreignKey: 'company_id', as: 'notices' });
(Notice as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(User as any).hasMany(Notice, { foreignKey: 'author_id', as: 'notices' });
(Notice as any).belongsTo(User, { foreignKey: 'author_id', as: 'author' });

(Notice as any).hasMany(NoticeView, { foreignKey: 'notice_id', as: 'viewsLog' });
(NoticeView as any).belongsTo(Notice, { foreignKey: 'notice_id', as: 'notice' });
(User as any).hasMany(NoticeView, { foreignKey: 'user_id', as: 'noticeViews' });
(NoticeView as any).belongsTo(User, { foreignKey: 'user_id', as: 'viewer' });

(Notice as any).hasOne(NoticePoll, { foreignKey: 'notice_id', as: 'poll' });
(NoticePoll as any).belongsTo(Notice, { foreignKey: 'notice_id', as: 'notice' });
(NoticePoll as any).hasMany(NoticePollOption, { foreignKey: 'poll_id', as: 'options' });
(NoticePollOption as any).belongsTo(NoticePoll, { foreignKey: 'poll_id', as: 'poll' });
(NoticePoll as any).hasMany(NoticePollVote, { foreignKey: 'poll_id', as: 'votes' });
(NoticePollVote as any).belongsTo(NoticePoll, { foreignKey: 'poll_id', as: 'poll' });
(NoticePollOption as any).hasMany(NoticePollVote, { foreignKey: 'option_id', as: 'votes' });
(NoticePollVote as any).belongsTo(NoticePollOption, { foreignKey: 'option_id', as: 'option' });
(User as any).hasMany(NoticePollVote, { foreignKey: 'user_id', as: 'noticePollVotes' });
(NoticePollVote as any).belongsTo(User, { foreignKey: 'user_id', as: 'voter' });

(Tenant as any).hasMany(CompanyPolicy, { foreignKey: 'tenant_id', as: 'companyPolicies' });
(CompanyPolicy as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(CompanyPolicy, { foreignKey: 'company_id', as: 'companyPolicies' });
(CompanyPolicy as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(CompanyPolicy, { foreignKey: 'updated_by', as: 'updatedCompanyPolicies' });
(CompanyPolicy as any).belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });
(CompanyPolicy as any).hasMany(CompanyPolicyRevision, { foreignKey: 'policy_id', as: 'revisions' });
(CompanyPolicyRevision as any).belongsTo(CompanyPolicy, { foreignKey: 'policy_id', as: 'policy' });
(User as any).hasMany(CompanyPolicyRevision, { foreignKey: 'changed_by', as: 'companyPolicyRevisions' });
(CompanyPolicyRevision as any).belongsTo(User, { foreignKey: 'changed_by', as: 'editor' });

// 회사와 GST 번호 관계
(Company as any).hasMany(CompanyGstNumber, { foreignKey: 'company_id', as: 'gstNumbers' });
CompanyGstNumber.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 파트너 관계
(Tenant as any).hasMany(Partner, { foreignKey: 'tenant_id', as: 'partners' });
(Partner as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

(Company as any).hasMany(Partner, { foreignKey: 'company_id', as: 'partners' });
(Partner as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// 파트너와 GST 번호 관계
(Partner as any).hasMany(PartnerGstNumber, { foreignKey: 'partner_id', as: 'gstNumbers' });
PartnerGstNumber.belongsTo(Partner, { foreignKey: 'partner_id', as: 'partner' });

// 회계 관리 관계
(Tenant as any).hasMany(ExpenseReport, { foreignKey: 'tenant_id', as: 'expenseReports' });
ExpenseReport.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(ExpenseReport, { foreignKey: 'company_id', as: 'expenseReports' });
ExpenseReport.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Tenant as any).hasMany(Budget, { foreignKey: 'tenant_id', as: 'budgets' });
Budget.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(Budget, { foreignKey: 'company_id', as: 'budgets' });
Budget.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Tenant as any).hasMany(Asset, { foreignKey: 'tenant_id', as: 'assets' });
Asset.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(Asset, { foreignKey: 'company_id', as: 'assets' });
Asset.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Tenant as any).hasMany(AutoVoucher, { foreignKey: 'tenant_id', as: 'autoVouchers' });
AutoVoucher.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AutoVoucher, { foreignKey: 'company_id', as: 'autoVouchers' });
AutoVoucher.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(AutoVoucher, { foreignKey: 'created_by', as: 'createdAutoVouchers' });
AutoVoucher.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(Tenant as any).hasMany(AutoVoucherRule, { foreignKey: 'tenant_id', as: 'autoVoucherRules' });
AutoVoucherRule.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AutoVoucherRule, { foreignKey: 'company_id', as: 'autoVoucherRules' });
AutoVoucherRule.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(AutoVoucher as any).hasMany(AutoVoucherAuditLog, { foreignKey: 'auto_voucher_id', as: 'auditLogs' });
AutoVoucherAuditLog.belongsTo(AutoVoucher, { foreignKey: 'auto_voucher_id', as: 'voucher' });
(User as any).hasMany(AutoVoucherAuditLog, { foreignKey: 'actor_id', as: 'autoVoucherAuditActions' });
AutoVoucherAuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

(Tenant as any).hasMany(AccountingBrainAuditLog, { foreignKey: 'tenant_id', as: 'accountingBrainAuditLogs' });
AccountingBrainAuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AccountingBrainAuditLog, { foreignKey: 'company_id', as: 'accountingBrainAuditLogs' });
AccountingBrainAuditLog.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(AccountingBrainAuditLog, { foreignKey: 'user_id', as: 'accountingBrainActions' });
AccountingBrainAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

(Tenant as any).hasMany(AiLearningCorrection, { foreignKey: 'tenant_id', as: 'aiLearningCorrections' });
AiLearningCorrection.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AiLearningCorrection, { foreignKey: 'company_id', as: 'aiLearningCorrections' });
AiLearningCorrection.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(AiLearningCorrection, { foreignKey: 'user_id', as: 'aiLearningCorrections' });
AiLearningCorrection.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

(GlAccount as any).belongsTo(GlAccount, { foreignKey: 'parent_id', as: 'parent' });
(GlAccount as any).hasMany(GlAccount, { foreignKey: 'parent_id', as: 'children' });
(Tenant as any).hasMany(GlAccount, { foreignKey: 'tenant_id', as: 'glAccounts' });
GlAccount.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(GlAccount, { foreignKey: 'company_id', as: 'glAccounts' });
GlAccount.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

(Tenant as any).hasMany(GlVoucher, { foreignKey: 'tenant_id', as: 'glVouchers' });
GlVoucher.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(GlVoucher, { foreignKey: 'company_id', as: 'glVouchers' });
GlVoucher.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(GlVoucher as any).hasMany(GlVoucherLine, { foreignKey: 'voucher_id', as: 'lines' });
GlVoucherLine.belongsTo(GlVoucher, { foreignKey: 'voucher_id', as: 'voucher' });
(GlAccount as any).hasMany(GlVoucherLine, { foreignKey: 'account_id', as: 'voucherLines' });
GlVoucherLine.belongsTo(GlAccount, { foreignKey: 'account_id', as: 'account' });

// 외부 회계 Import (SAP 등) — 원본과 배치를 분리해 재검증에도 생성 전표를 중복하지 않는다.
(Tenant as any).hasMany(AcImportTemplate, { foreignKey: 'tenant_id', as: 'accountingImportTemplates' });
AcImportTemplate.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AcImportTemplate, { foreignKey: 'company_id', as: 'accountingImportTemplates' });
AcImportTemplate.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(Tenant as any).hasMany(AcImportBatch, { foreignKey: 'tenant_id', as: 'accountingImportBatches' });
AcImportBatch.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AcImportBatch, { foreignKey: 'company_id', as: 'accountingImportBatches' });
AcImportBatch.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
AcImportBatch.belongsTo(AcImportTemplate, { foreignKey: 'template_id', as: 'template' });
AcImportTemplate.hasMany(AcImportBatch, { foreignKey: 'template_id', as: 'batches' });
(Tenant as any).hasMany(AcImportSourceDocument, { foreignKey: 'tenant_id', as: 'accountingImportSourceDocuments' });
AcImportSourceDocument.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AcImportSourceDocument, { foreignKey: 'company_id', as: 'accountingImportSourceDocuments' });
AcImportSourceDocument.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
AcImportSourceDocument.belongsTo(GlVoucher, { foreignKey: 'voucher_id', as: 'voucher' });
AcImportBatch.hasMany(AcImportBatchDocument, { foreignKey: 'batch_id', as: 'documents' });
AcImportBatchDocument.belongsTo(AcImportBatch, { foreignKey: 'batch_id', as: 'batch' });
AcImportSourceDocument.hasMany(AcImportBatchDocument, { foreignKey: 'source_document_id', as: 'batchLinks' });
AcImportBatchDocument.belongsTo(AcImportSourceDocument, { foreignKey: 'source_document_id', as: 'sourceDocument' });
(Tenant as any).hasMany(AcImportMapping, { foreignKey: 'tenant_id', as: 'accountingImportMappings' });
AcImportMapping.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(AcImportMapping, { foreignKey: 'company_id', as: 'accountingImportMappings' });
AcImportMapping.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
AcImportBatch.hasMany(AcImportIssue, { foreignKey: 'batch_id', as: 'issues' });
AcImportIssue.belongsTo(AcImportBatch, { foreignKey: 'batch_id', as: 'batch' });
AcImportSourceDocument.hasMany(AcImportIssue, { foreignKey: 'source_document_id', as: 'issues' });
AcImportIssue.belongsTo(AcImportSourceDocument, { foreignKey: 'source_document_id', as: 'sourceDocument' });

// 작업 보드 (트렐로형)
(Tenant as any).hasMany(WorkBoard, { foreignKey: 'tenant_id', as: 'workBoards' });
(WorkBoard as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(WorkBoard, { foreignKey: 'company_id', as: 'workBoards' });
(WorkBoard as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(WorkBoard, { foreignKey: 'created_by', as: 'createdWorkBoards' });
(WorkBoard as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

(WorkBoard as any).hasMany(WorkBoardList, { foreignKey: 'board_id', as: 'lists' });
(WorkBoardList as any).belongsTo(WorkBoard, { foreignKey: 'board_id', as: 'board' });

(WorkBoardList as any).hasMany(WorkBoardCard, { foreignKey: 'list_id', as: 'cards' });
(WorkBoardCard as any).belongsTo(WorkBoardList, { foreignKey: 'list_id', as: 'list' });
(User as any).hasMany(WorkBoardList, { foreignKey: 'assignee_user_id', as: 'assignedBoardLists' });
(WorkBoardList as any).belongsTo(User, { foreignKey: 'assignee_user_id', as: 'assignee' });
(User as any).hasMany(WorkBoardCard, { foreignKey: 'assignee_user_id', as: 'assignedBoardCards' });
(WorkBoardCard as any).belongsTo(User, { foreignKey: 'assignee_user_id', as: 'assignee' });
(User as any).hasMany(WorkBoardCard, { foreignKey: 'created_by', as: 'createdBoardCards' });
(WorkBoardCard as any).belongsTo(User, { foreignKey: 'created_by', as: 'cardCreator' });
(WorkBoardCard as any).hasMany(WorkBoardCardComment, { foreignKey: 'card_id', as: 'comments' });
(WorkBoardCardComment as any).belongsTo(WorkBoardCard, { foreignKey: 'card_id', as: 'card' });
(User as any).hasMany(WorkBoardCardComment, { foreignKey: 'user_id', as: 'boardCardComments' });
(WorkBoardCardComment as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });
(WorkBoardCardComment as any).belongsTo(WorkBoardCardComment, {
  foreignKey: 'parent_id',
  as: 'parentComment'
});
(WorkBoardCardComment as any).hasMany(WorkBoardCardComment, {
  foreignKey: 'parent_id',
  as: 'replies'
});

(WorkBoard as any).hasMany(WorkBoardMember, { foreignKey: 'board_id', as: 'members' });
(WorkBoardMember as any).belongsTo(WorkBoard, { foreignKey: 'board_id', as: 'board' });
(User as any).hasMany(WorkBoardMember, { foreignKey: 'user_id', as: 'boardMemberships' });
(WorkBoardMember as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });
(WorkBoardMember as any).belongsTo(User, { foreignKey: 'invited_by', as: 'inviter' });

(WorkBoard as any).hasMany(RecurringTaskTemplate, { foreignKey: 'board_id', as: 'recurringTemplates' });
(RecurringTaskTemplate as any).belongsTo(WorkBoard, { foreignKey: 'board_id', as: 'board' });
(WorkBoard as any).hasMany(RecurringBoardClient, { foreignKey: 'board_id', as: 'recurringClients' });
(RecurringBoardClient as any).belongsTo(WorkBoard, { foreignKey: 'board_id', as: 'board' });
(Customer as any).hasMany(RecurringBoardClient, { foreignKey: 'customer_id', as: 'recurringBoardLinks' });
(RecurringBoardClient as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
(WorkBoard as any).hasMany(RecurringTaskAssignment, { foreignKey: 'board_id', as: 'recurringAssignments' });
(RecurringTaskAssignment as any).belongsTo(WorkBoard, { foreignKey: 'board_id', as: 'board' });
(RecurringTaskTemplate as any).hasMany(RecurringTaskAssignment, { foreignKey: 'template_id', as: 'assignments' });
(RecurringTaskAssignment as any).belongsTo(RecurringTaskTemplate, { foreignKey: 'template_id', as: 'template' });
(Customer as any).hasMany(RecurringTaskAssignment, { foreignKey: 'customer_id', as: 'recurringAssignments' });
(RecurringTaskAssignment as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
(User as any).hasMany(RecurringTaskAssignment, { foreignKey: 'assigned_user_id', as: 'recurringAssignedTasks' });
(RecurringTaskAssignment as any).belongsTo(User, { foreignKey: 'assigned_user_id', as: 'assignee' });
(User as any).hasMany(RecurringTaskAssignment, { foreignKey: 'reviewer_user_id', as: 'recurringReviewTasks' });
(RecurringTaskAssignment as any).belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });

(WorkBoard as any).hasMany(RecurringTaskInstance, { foreignKey: 'board_id', as: 'recurringInstances' });
(RecurringTaskInstance as any).belongsTo(WorkBoard, { foreignKey: 'board_id', as: 'board' });
(RecurringTaskTemplate as any).hasMany(RecurringTaskInstance, { foreignKey: 'template_id', as: 'instances' });
(RecurringTaskInstance as any).belongsTo(RecurringTaskTemplate, { foreignKey: 'template_id', as: 'template' });
(Customer as any).hasMany(RecurringTaskInstance, { foreignKey: 'customer_id', as: 'recurringInstances' });
(RecurringTaskInstance as any).belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
(User as any).hasMany(RecurringTaskInstance, { foreignKey: 'assigned_user_id', as: 'recurringInstanceAssigned' });
(RecurringTaskInstance as any).belongsTo(User, { foreignKey: 'assigned_user_id', as: 'assignee' });
(User as any).hasMany(RecurringTaskInstance, { foreignKey: 'reviewer_user_id', as: 'recurringInstanceReview' });
(RecurringTaskInstance as any).belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });

(Tenant as any).hasMany(WorkAssignee, { foreignKey: 'tenant_id', as: 'workAssignees' });
(WorkAssignee as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(WorkAssignee, { foreignKey: 'company_id', as: 'workAssignees' });
(WorkAssignee as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(WorkAssignee, { foreignKey: 'created_by', as: 'createdWorkAssignees' });
(WorkAssignee as any).belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
(User as any).hasMany(WorkAssignee, { foreignKey: 'user_id', as: 'workAssigneeColumns' });
(WorkAssignee as any).belongsTo(User, { foreignKey: 'user_id', as: 'assignedUser' });
(WorkAssignee as any).hasMany(WorkAssigneeItem, { foreignKey: 'assignee_id', as: 'items' });
(WorkAssigneeItem as any).belongsTo(WorkAssignee, { foreignKey: 'assignee_id', as: 'assignee' });
(Partner as any).hasMany(WorkAssigneeItem, { foreignKey: 'partner_id', as: 'workAssigneeItems' });
(WorkAssigneeItem as any).belongsTo(Partner, { foreignKey: 'partner_id', as: 'partner' });

// 전자근로계약
(Tenant as any).hasMany(EmploymentContractTemplate, { foreignKey: 'tenant_id', as: 'employmentContractTemplates' });
(EmploymentContractTemplate as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(EmploymentContractTemplate, { foreignKey: 'company_id', as: 'employmentContractTemplates' });
(EmploymentContractTemplate as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(EmploymentContractTemplate, { foreignKey: 'created_by', as: 'createdEmploymentContractTemplates' });
(EmploymentContractTemplate as any).belongsTo(User, { foreignKey: 'created_by', as: 'templateCreator' });

(Tenant as any).hasMany(EmploymentContract, { foreignKey: 'tenant_id', as: 'employmentContracts' });
(EmploymentContract as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(EmploymentContract, { foreignKey: 'company_id', as: 'employmentContracts' });
(EmploymentContract as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(EmploymentContract, { foreignKey: 'employee_id', as: 'employeeContracts' });
(EmploymentContract as any).belongsTo(User, { foreignKey: 'employee_id', as: 'employee' });
(User as any).hasMany(EmploymentContract, { foreignKey: 'approver_id', as: 'approverContracts' });
(EmploymentContract as any).belongsTo(User, { foreignKey: 'approver_id', as: 'approver' });
(EmploymentContractTemplate as any).hasMany(EmploymentContract, { foreignKey: 'template_id', as: 'contracts' });
(EmploymentContract as any).belongsTo(EmploymentContractTemplate, { foreignKey: 'template_id', as: 'template' });

(EmploymentContract as any).hasMany(EmploymentContractSignature, { foreignKey: 'contract_id', as: 'signatures' });
(EmploymentContractSignature as any).belongsTo(EmploymentContract, { foreignKey: 'contract_id', as: 'contract' });
(User as any).hasMany(EmploymentContractSignature, { foreignKey: 'signer_id', as: 'employmentContractSignatures' });
(EmploymentContractSignature as any).belongsTo(User, { foreignKey: 'signer_id', as: 'signer' });
(EmploymentContract as any).hasMany(EmploymentContractEsignSession, { foreignKey: 'contract_id', as: 'esignSessions' });
(EmploymentContractEsignSession as any).belongsTo(EmploymentContract, { foreignKey: 'contract_id', as: 'contract' });
(User as any).hasMany(EmploymentContractEsignSession, { foreignKey: 'signer_id', as: 'employmentContractEsignSessions' });
(EmploymentContractEsignSession as any).belongsTo(User, { foreignKey: 'signer_id', as: 'signer' });

(EmploymentContract as any).hasMany(EmploymentContractAuditLog, { foreignKey: 'contract_id', as: 'auditLogs' });
(EmploymentContractAuditLog as any).belongsTo(EmploymentContract, { foreignKey: 'contract_id', as: 'contract' });
(Tenant as any).hasMany(EmploymentContractAuditLog, { foreignKey: 'tenant_id', as: 'employmentContractAuditLogs' });
(EmploymentContractAuditLog as any).belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
(Company as any).hasMany(EmploymentContractAuditLog, { foreignKey: 'company_id', as: 'employmentContractAuditLogs' });
(EmploymentContractAuditLog as any).belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
(User as any).hasMany(EmploymentContractAuditLog, { foreignKey: 'actor_id', as: 'employmentContractAuditActions' });
(EmploymentContractAuditLog as any).belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

(User as any).hasMany(WebAuthnCredential, { foreignKey: 'user_id', as: 'webauthnCredentials' });
(WebAuthnCredential as any).belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 데이터베이스 연결 함수
const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await sequelize.authenticate();
      console.log('Database connection successful');

      await ensureUserEmploymentTypeEnum(sequelize);

      return;
    } catch (error) {
      retries++;
      console.error(`Database connection failed (attempt ${retries}/${maxRetries}):`, error.message);
      
      if (retries >= maxRetries) {
        console.error('Maximum retry attempts exceeded. Continuing server startup.');
        return;
      }
      
      console.log(`Retrying in ${5000 * retries}ms...`);
      await new Promise(resolve => setTimeout(resolve, 5000 * retries));
    }
  }
};

export { 
  sequelize, 
  User, 
  Menu, 
  UserPermission, 
  Company, 
  LoginInfo,
  LoginInfoTab,
  LoginLog,
  Tenant,
  Department,
  Position,
  Customer,
  Contract,
  ContractType,
  SupportTicket,
  SupportResponse,
  Invoice,
  InvoiceItem,
  Product,
  ProductCategory,
  ProductUnit,
  InventoryLocation,
  Project,
  ProjectMember,
  ProjectSchedule,
  ProjectTask,
  ProjectTaskAssignee,
  ProjectActivity,
  ProjectTaskComment,
  Payroll,
  PayrollBonus,
  PayrollPeriodLock,
  PayslipDelivery,
  InventoryTransaction,
  CompanyGstNumber,
  Partner,
  PartnerGstNumber,
  Attendance,
  Vacation,
  Performance,
  WorkStatistic,
  Approval,
  Quotation,
  RoomBooking,
  RoomType,
  RoomTypeRoom,
  WorkReport,
  EWayBill,
  EWayBillItem,
  Notice,
  NoticePoll,
  NoticePollOption,
  NoticePollVote,
  NoticeView,
  CompanyPolicy,
  CompanyPolicyRevision,
  ExpenseReport,
  Budget,
  Asset,
  AutoVoucher,
  AutoVoucherRule,
  AutoVoucherAuditLog,
  AccountingBrainAuditLog,
  AiLearningCorrection,
  GlAccount,
  GlVoucher,
  GlVoucherLine,
  AcVoucherType,
  AcTransactionItem,
  AcGstCode,
  AcTdsCode,
  AcBankAccount,
  AcFinancialYear,
  AcVoucherAuditLog,
  AcImportTemplate,
  AcImportBatch,
  AcImportSourceDocument,
  AcImportBatchDocument,
  AcImportMapping,
  AcImportIssue,
  WorkBoard,
  WorkBoardList,
  WorkBoardCard,
  WorkBoardCardComment,
  WorkBoardMember,
  RecurringTaskTemplate,
  RecurringBoardClient,
  RecurringTaskAssignment,
  RecurringTaskInstance,
  WorkAssignee,
  WorkAssigneeItem,
  ApprovalType,
  CompanyCalendarSchedule,
  WebAuthnCredential,
  EmploymentContractTemplate,
  EmploymentContract,
  EmploymentContractSignature,
  EmploymentContractEsignSession,
  EmploymentContractAuditLog,
  connectDB 
};
