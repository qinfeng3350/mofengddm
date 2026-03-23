export interface DingtalkDepartment {
  id: number;
  name: string;
  parent_id: number;
  order: number;
  dept_id: number;
}

export interface DingtalkUser {
  userid: string;
  name: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  dept_id_list?: number[];
  position?: string;
  jobnumber?: string;
  // 其他可能存在的字段
  title?: string;
  hired_date?: string;
  work_place?: string;
  remark?: string;
  manager_userid?: string;
  is_admin?: boolean;
  is_boss?: boolean;
  active?: boolean;
}

export interface DingtalkAccessTokenResponse {
  errcode: number;
  errmsg: string;
  access_token?: string;
  expires_in?: number;
}

export interface DingtalkDepartmentResponse {
  errcode: number;
  errmsg: string;
  result?: DingtalkDepartment[]; // v2 API 使用 result 字段
  department?: DingtalkDepartment[]; // v1 API 使用 department 字段
}

export interface DingtalkUserResponse {
  errcode: number;
  errmsg: string;
  result?: {
    list?: DingtalkUser[]; // v2 API 使用 list 字段
    userlist?: DingtalkUser[]; // 备用字段
    hasMore?: boolean;
    nextCursor?: number;
  };
  userlist?: DingtalkUser[]; // v1 API 使用 userlist 字段
  hasMore?: boolean;
}

