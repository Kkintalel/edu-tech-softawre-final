import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getAllSclasses, getSubjectDetails } from '../../../redux/sclassRelated/sclassHandle';
import Popup from '../../../components/Popup';
import { registerUser } from '../../../redux/userRelated/userHandle';
import { underControl } from '../../../redux/userRelated/userSlice';
import { CircularProgress } from '@mui/material';

const API_BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:5000';

const AddTeacher = () => {
  const params = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { currentUser } = useSelector(state => state.user)

  const subjectID = params.id
  const schoolValue = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;
  const schoolId = schoolValue && typeof schoolValue === 'object'
    ? schoolValue._id || schoolValue.id || schoolValue.schoolId
    : schoolValue;

  const { status, response, error } = useSelector(state => state.user);
  const { sclassesList, subjectDetails } = useSelector((state) => state.sclass);

  // Fetch classes on mount (if no subject ID in params) or fetch subject details (if subject ID in params)
  useEffect(() => {
    if (subjectID) {
      dispatch(getSubjectDetails(subjectID, "Subject"));
    } else if (schoolId) {
      dispatch(getAllSclasses(schoolId, "Sclass"));
    }
  }, [dispatch, subjectID, schoolId]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('');
  const [salary, setSalary] = useState('0');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [subjectsByClass, setSubjectsByClass] = useState({});
  const [selectedSubjectsByClass, setSelectedSubjectsByClass] = useState({});

  const [showPopup, setShowPopup] = useState(false);
  const [message, setMessage] = useState("");
  const [loader, setLoader] = useState(false)

  useEffect(() => {
    let active = true;
    Promise.all(selectedClasses.map(async (classId) => {
      try {
        const result = await axios.get(`${API_BASE_URL}/FreeSubjectList/${classId}`);
        return [classId, Array.isArray(result.data) ? result.data : []];
      } catch (error) {
        return [classId, []];
      }
    })).then((entries) => {
      if (active) setSubjectsByClass(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [selectedClasses]);

  const role = "Teacher"

  useEffect(() => {
    if (subjectDetails?._id) {
      setSelectedSubjectsByClass({});
    }
  }, [subjectDetails]);
  
  const selectedSubjectIds = subjectID
    ? (subjectDetails?._id ? [subjectDetails._id] : [])
    : selectedClasses.flatMap((classId) => selectedSubjectsByClass[classId] || []);
  const firstSelectedSubject = Object.values(subjectsByClass).flat().find((subject) => subject._id === selectedSubjectIds[0]);
  const school = firstSelectedSubject?.school || subjectDetails?.school;
  const teachSubject = selectedSubjectIds[0];
  const teachSclass = subjectDetails?.sclassName?._id || selectedClasses[0];
  const teachSclasses = subjectID ? [teachSclass].filter(Boolean) : selectedClasses;

  const schoolValueForSubmission = school?._id || school?.id || school || schoolId;
  const fields = { name, email, password, phone, employeeId, salary: parseFloat(salary) || 0, bankName, bankAccount, accountHolderName, role, school: schoolValueForSubmission, teachSubject, teachSubjects: selectedSubjectIds, teachSclass, teachSclasses }
  const missingSelection = !teachSubject || !teachSclass || selectedSubjectIds.length === 0

  const submitHandler = (event) => {
    event.preventDefault()
    setLoader(true)
    dispatch(registerUser(fields, role))
  }

  useEffect(() => {
    if (status === 'added') {
      setMessage('Teacher registered successfully.');
      setShowPopup(true);
      setLoader(false);
      const redirectTimer = setTimeout(() => {
        dispatch(underControl())
        navigate("/Admin/teachers")
      }, 1200);

      return () => clearTimeout(redirectTimer);
    }
    else if (status === 'failed') {
      setMessage(response)
      setShowPopup(true)
      setLoader(false)
    }
    else if (status === 'error') {
      setMessage(error || response || "Network Error")
      setShowPopup(true)
      setLoader(false)
    }
  }, [status, navigate, error, response, dispatch]);

  return (
    <div>
      <div className="register">
        <form className="registerForm" onSubmit={submitHandler}>
          <span className="registerTitle">Add Teacher</span>
          <br />

          {!subjectID && (
            <>
              <label>Select Classes</label>
              <select
                className="registerInput"
                multiple
                value={selectedClasses}
                onChange={(event) => setSelectedClasses(Array.from(event.target.selectedOptions, (option) => option.value))}
                required
              >
                {Array.isArray(sclassesList) && sclassesList.map((sclass) => (
                  <option key={sclass._id} value={sclass._id}>{sclass.sclassName}</option>
                ))}
              </select>
              {selectedClasses.map((classId) => {
                const classItem = sclassesList.find((item) => item._id === classId);
                return (
                  <React.Fragment key={classId}>
                    <label>Subjects for {classItem?.sclassName || 'selected class'}</label>
                    <select
                      className="registerInput"
                      multiple
                      value={selectedSubjectsByClass[classId] || []}
                      onChange={(event) => {
                        const selected = Array.from(event.target.selectedOptions, (option) => option.value);
                        setSelectedSubjectsByClass((current) => ({ ...current, [classId]: selected }));
                      }}
                    >
                      {(subjectsByClass[classId] || []).map((subject) => (
                        <option key={subject._id} value={subject._id}>{subject.subName}</option>
                      ))}
                    </select>
                  </React.Fragment>
                );
              })}
            </>
          )}

          {/* Display selected class and subject if from params */}
          {subjectID && subjectDetails && (
            <>
              <label>
                Subject : {subjectDetails && subjectDetails.subName}
              </label>
              <label>
                Class : {subjectDetails && subjectDetails.sclassName && subjectDetails.sclassName.sclassName}
              </label>
            </>
          )}

          <label>Name</label>
          <input
            className="registerInput"
            type="text"
            placeholder="Enter teacher's name..."
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />

          <label>Email</label>
          <input
            className="registerInput"
            type="email"
            placeholder="Enter teacher's email..."
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label>Password</label>
          <input
            className="registerInput"
            type="password"
            placeholder="Enter teacher's password..."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />

          <label>Staff Number (Optional)</label>
          <input
            className="registerInput"
            type="text"
            placeholder="Enter teacher staff number..."
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          />

          <label>Phone (Optional)</label>
          <input
            className="registerInput"
            type="tel"
            placeholder="Enter teacher's phone number..."
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />

          <label>Salary (Optional)</label>
          <input
            className="registerInput"
            type="number"
            placeholder="Enter teacher's salary..."
            value={salary}
            onChange={(event) => setSalary(event.target.value)}
            min="0"
            step="0.01"
          />

          <label>Bank Name (Optional)</label>
          <input
            className="registerInput"
            type="text"
            placeholder="Enter bank name..."
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
          />

          <label>Bank Account Number (Optional)</label>
          <input
            className="registerInput"
            type="text"
            placeholder="Enter bank account number..."
            value={bankAccount}
            onChange={(event) => setBankAccount(event.target.value)}
          />

          <label>Account Holder Name (Optional)</label>
          <input
            className="registerInput"
            type="text"
            placeholder="Enter account holder's name..."
            value={accountHolderName}
            onChange={(event) => setAccountHolderName(event.target.value)}
          />

          <button
            className="registerButton"
            type="submit"
            disabled={loader || missingSelection}
          >
            {loader ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Register'
            )}
          </button>
        </form>
      </div>
      <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
    </div>
  )
}

export default AddTeacher