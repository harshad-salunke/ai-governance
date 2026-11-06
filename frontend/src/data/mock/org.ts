import type { BusinessUnit, User } from '../types';
import { daysAgo, hoursAgo, minsAgo } from '../seed';

export const businessUnits: BusinessUnit[] = [
  { id: 'bu-retail', name: 'Retail Banking', head: 'u-sanjay', costCentre: 'CC-1100' },
  { id: 'bu-wealth', name: 'Wealth Management', head: 'u-sunita', costCentre: 'CC-1200' },
  { id: 'bu-cs', name: 'Customer Service', head: 'u-kavya', costCentre: 'CC-1300' },
  { id: 'bu-hr', name: 'People & HR', head: 'u-lakshmi', costCentre: 'CC-1400' },
  { id: 'bu-fin', name: 'Finance', head: 'u-ishaan', costCentre: 'CC-1500' },
  { id: 'bu-ops', name: 'Operations', head: 'u-gaurav', costCentre: 'CC-1600' },
  { id: 'bu-it', name: 'Technology', head: 'u-ananya', costCentre: 'CC-1700' },
];

export const users: User[] = [
  { id: 'u-harshad', name: 'Harshad Salunke', email: 'harshad.salunke@corp.com', title: 'Platform Engineering Lead', businessUnitId: 'bu-it', roles: ['platform_admin', 'governance_lead'], status: 'active', lastActive: minsAgo(1) },
  { id: 'u-ananya', name: 'Ananya Iyer', email: 'ananya.iyer@corp.com', title: 'Head of Responsible AI', businessUnitId: 'bu-it', roles: ['governance_lead'], status: 'active', lastActive: minsAgo(24) },
  { id: 'u-vikram', name: 'Vikram Rao', email: 'vikram.rao@corp.com', title: 'Deputy CISO', businessUnitId: 'bu-it', roles: ['security_admin'], status: 'active', lastActive: hoursAgo(2) },
  { id: 'u-meera', name: 'Meera Nair', email: 'meera.nair@corp.com', title: 'Senior Risk Manager', businessUnitId: 'bu-ops', roles: ['risk_reviewer'], status: 'active', lastActive: hoursAgo(1) },
  { id: 'u-rahul', name: 'Rahul Menon', email: 'rahul.menon@corp.com', title: 'Staff Engineer, Service AI', businessUnitId: 'bu-cs', roles: ['agent_owner'], status: 'active', lastActive: minsAgo(8) },
  { id: 'u-priya', name: 'Priya Sharma', email: 'priya.sharma@corp.com', title: 'ML Engineer, Finance', businessUnitId: 'bu-fin', roles: ['agent_owner'], status: 'active', lastActive: hoursAgo(5) },
  { id: 'u-arjun', name: 'Arjun Kapoor', email: 'arjun.kapoor@corp.com', title: 'Lead Engineer, Lending', businessUnitId: 'bu-retail', roles: ['agent_owner'], status: 'active', lastActive: hoursAgo(3) },
  { id: 'u-kavya', name: 'Kavya Reddy', email: 'kavya.reddy@corp.com', title: 'VP, Customer Service', businessUnitId: 'bu-cs', roles: ['business_sponsor'], status: 'active', lastActive: hoursAgo(20) },
  { id: 'u-sanjay', name: 'Sanjay Gupta', email: 'sanjay.gupta@corp.com', title: 'Director, Retail Lending', businessUnitId: 'bu-retail', roles: ['business_sponsor'], status: 'active', lastActive: daysAgo(1) },
  { id: 'u-neha', name: 'Neha Joshi', email: 'neha.joshi@corp.com', title: 'FinOps Manager', businessUnitId: 'bu-fin', roles: ['finops_manager'], status: 'active', lastActive: hoursAgo(4) },
  { id: 'u-farhan', name: 'Farhan Sheikh', email: 'farhan.sheikh@corp.com', title: 'Internal Audit Manager', businessUnitId: 'bu-ops', roles: ['auditor'], status: 'active', lastActive: daysAgo(2) },
  { id: 'u-lakshmi', name: 'Lakshmi Pillai', email: 'lakshmi.pillai@corp.com', title: 'CHRO', businessUnitId: 'bu-hr', roles: ['business_sponsor'], status: 'active', lastActive: daysAgo(3) },
  { id: 'u-rohan', name: 'Rohan Das', email: 'rohan.das@corp.com', title: 'HR Tech Engineer', businessUnitId: 'bu-hr', roles: ['agent_owner'], status: 'active', lastActive: hoursAgo(7) },
  { id: 'u-deepa', name: 'Deepa Krishnan', email: 'deepa.krishnan@corp.com', title: 'Data Scientist (left)', businessUnitId: 'bu-wealth', roles: ['agent_owner'], status: 'disabled', manager: 'u-amit', lastActive: daysAgo(41) },
  { id: 'u-amit', name: 'Amit Verma', email: 'amit.verma@corp.com', title: 'Engineering Manager, Wealth', businessUnitId: 'bu-wealth', roles: ['agent_owner'], status: 'active', lastActive: hoursAgo(9) },
  { id: 'u-sunita', name: 'Sunita Bose', email: 'sunita.bose@corp.com', title: 'MD, Wealth Management', businessUnitId: 'bu-wealth', roles: ['business_sponsor'], status: 'active', lastActive: daysAgo(4) },
  { id: 'u-karan', name: 'Karan Malhotra', email: 'karan.malhotra@corp.com', title: 'SRE Lead', businessUnitId: 'bu-ops', roles: ['agent_owner'], status: 'active', lastActive: minsAgo(52) },
  { id: 'u-ishaan', name: 'Ishaan Mehta', email: 'ishaan.mehta@corp.com', title: 'Financial Controller', businessUnitId: 'bu-fin', roles: ['business_sponsor'], status: 'active', lastActive: daysAgo(1) },
  { id: 'u-gaurav', name: 'Gaurav Singh', email: 'gaurav.singh@corp.com', title: 'Head of Operations', businessUnitId: 'bu-ops', roles: ['business_sponsor'], status: 'active', lastActive: daysAgo(6) },
];
