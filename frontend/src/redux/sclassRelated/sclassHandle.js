import axios from 'axios';
import {
    getRequest,
    getSuccess,
    getFailed,
    getError,
    getStudentsSuccess,
    detailsSuccess,
    getFailedTwo,
    getSubjectsSuccess,
    getSubDetailsSuccess,
    getSubDetailsRequest,
    operationSuccess
} from './sclassSlice';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const getCurrentUserFromStorage = () => {
    if (typeof window === 'undefined') return {};

    try {
        return JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('user') || 'null') || {};
    } catch (error) {
        return {};
    }
};

const buildRequestHeaders = (user = {}) => {
    const headers = {};
    const requesterId = user?._id || user?.id || null;
    const schoolId = user?.school?._id || user?.school || user?.schoolId || null;
    const token = user?.token || null;

    if (requesterId) {
        headers['x-admin-id'] = requesterId;
        headers['x-user-id'] = requesterId;
    } else if (schoolId) {
        headers['x-admin-id'] = schoolId;
        headers['x-user-id'] = schoolId;
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
};

export const getAllSclasses = (id, address) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.get(`${API_BASE_URL}/${address}List/${id}`, {
            headers: { 'x-admin-id': id }
        });
        if (result.data.message) {
            dispatch(getFailedTwo(result.data.message));
        } else {
            dispatch(getSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getClassStudents = (id) => async (dispatch, getState) => {
    dispatch(getRequest());

    try {
        const stateUser = getState()?.user?.currentUser;
        const currentUser = stateUser || getCurrentUserFromStorage();
        const headers = buildRequestHeaders(currentUser);

        const result = await axios.get(`${API_BASE_URL}/Sclass/Students/${id}`, { headers });
        if (result.data.message) {
            dispatch(getFailedTwo(result.data.message));
        } else {
            dispatch(getStudentsSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getClassDetails = (id, address) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.get(`${API_BASE_URL}/${address}/${id}`);
        if (result.data) {
            dispatch(detailsSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getSubjectList = (id, address) => async (dispatch, getState) => {
    dispatch(getRequest());

    try {
        const stateUser = getState()?.user?.currentUser;
        const currentUser = stateUser || getCurrentUserFromStorage();
        const headers = buildRequestHeaders(currentUser);

        const result = await axios.get(`${API_BASE_URL}/${address}/${id}`, { headers });
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSubjectsSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getTeacherFreeClassSubjects = (id) => async (dispatch) => {
    dispatch(getRequest());

    try {
        const result = await axios.get(`${API_BASE_URL}/FreeSubjectList/${id}`);
        if (result.data.message) {
            dispatch(getFailed(result.data.message));
        } else {
            dispatch(getSubjectsSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const getSubjectDetails = (id, address) => async (dispatch, getState) => {
    dispatch(getSubDetailsRequest());

    try {
        const stateUser = getState()?.user?.currentUser;
        const currentUser = stateUser || getCurrentUserFromStorage();
        const headers = buildRequestHeaders(currentUser);

        const result = await axios.get(`${API_BASE_URL}/${address}/${id}`, { headers });
        if (result.data) {
            dispatch(getSubDetailsSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error));
    }
}

export const promoteClassStudents = (sourceClassId, targetClassId, options = {}) => async (dispatch, getState) => {
    dispatch(getRequest());
    try {
        const stateUser = getState()?.user?.currentUser;
        const storedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('currentUser') || 'null') : null;
        const fallbackUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
        const currentUser = stateUser || storedUser || fallbackUser || {};
        const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId || null;
        const headers = schoolId ? { 'x-admin-id': schoolId } : {};

        const payload = { targetClassId, completedTerms: options.completedTerms };
        if (options.moveSubjects) payload.moveSubjects = true;
        if (options.updateRollNumbers) payload.updateRollNumbers = true;

        const result = await axios.put(`${API_BASE_URL}/Sclass/Promote/${sourceClassId}`, payload, { headers });
        dispatch(operationSuccess());
        return result.data;
    } catch (error) {
        dispatch(getError(error));
        throw error;
    }
}