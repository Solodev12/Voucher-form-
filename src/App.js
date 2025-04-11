import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { convertNumberToWords } from "./utils";
import { useGoogleLogin } from "@react-oauth/google";
import Swal from "sweetalert2";
import "./App.css";

const filterImageMap = {
  Contentstack: "contentstack.png",
  Surfboard: "surfboard.png",
  RawEngineering: "raw.png",
};

const initialValues = {
  filter: "",
  voucherNo: "",
  date: new Date().toISOString().split("T")[0],
  payTo: "",
  accountHead: "",
  account: "",
  transactionType: "UPI", // Default to UPI
  amount: "",
  amountRs: "",
  checkedBy: "",
  approvedBy: "",
  receiverSignature: "",
};

const VoucherForm = () => {
  const [formData, setFormData] = useState(initialValues);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [showVouchers, setShowVouchers] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortAmount, setSortAmount] = useState("");

  const url = process.env.REACT_APP_API_URL || "https://form-server-6ror.onrender.com";

  // Configure Axios to include credentials (cookies) by default
  axios.defaults.withCredentials = true;

  // Check session on component mount
  const checkSession = async () => {
    try {
      const storedToken = localStorage.getItem("token");
      const response = await axios.get(`${url}/check-session`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });
      setUser({
        email: response.data.email,
        name: response.data.name,
        picture: response.data.picture,
      });
      setToken(storedToken);
      toast.success(`Welcome back, ${response.data.name}`);
      return true;
    } catch (error) {
      console.error("Session check failed:", error.message);
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      return false;
    }
  };

  const handleLoginSuccess = async (response) => {
    const accessToken = response.access_token;
    setToken(accessToken);
    localStorage.setItem("token", accessToken);

    try {
      const authResponse = await axios.get(`${url}/check-session`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUser({
        email: authResponse.data.email,
        name: authResponse.data.name,
        picture: authResponse.data.picture,
      });
      toast.success(`Logged in as ${authResponse.data.name}`);
    } catch (error) {
      console.error("Error authenticating with backend:", error.message);
      toast.error("Login failed: " + (error.response?.data?.error || error.message));
      setToken(null);
      localStorage.removeItem("token");
    }
  };

  const login = useGoogleLogin({
    onSuccess: handleLoginSuccess,
    onError: (error) => {
      console.error("Login Failed:", error);
      toast.error("Google Login Failed");
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    redirect_uri: "https://voucher-form-frontend-nu.vercel.app",
  });

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        ...(companyFilter && { company: companyFilter }),
        ...(dateFilter && { date: dateFilter }),
        ...(sortAmount && { sort: sortAmount }),
      }).toString();

      const response = await axios.get(`${url}/vouchers?${queryParams}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setVouchers(response.data);
    } catch (error) {
      console.error("Error fetching vouchers:", error.message);
      toast.error("Failed to fetch vouchers: " + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const keepServerAlive = () => {
      axios
        .get(`${url}/ping`)
        .then((response) => console.log("Server is active:", response.data.message))
        .catch((error) => console.error("Error pinging server:", error));
    };
    const interval = setInterval(keepServerAlive, 30000);
    return () => clearInterval(interval);
  }, [url]);

  useEffect(() => {
    const initializeApp = async () => {
      await checkSession();
    };
    initializeApp();
  }, []);

  useEffect(() => {
    const fetchVoucherNumber = async (filter) => {
      if (filter && !showVouchers) {
        try {
          setLoading(true);
          const response = await axios.get(`${url}/get-voucher-no?filter=${filter}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          setFormData((prevData) => ({
            ...prevData,
            voucherNo: response.data.voucherNo,
          }));
        } catch (error) {
          console.error("Error fetching voucher number:", error.message);
          toast.error("Failed to fetch voucher number: " + (error.response?.data?.error || error.message));
        } finally {
          setLoading(false);
        }
      }
    };

    if (formData.filter && !formData.voucherNo) {
      fetchVoucherNumber(formData.filter);
    }
  }, [formData.filter, showVouchers, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
      ...(name === "filter" && { voucherNo: "" }),
    }));
  };

  const convertAmountToWords = () => {
    const amount = parseFloat(formData.amount);
    if (!isNaN(amount)) {
      setFormData((prevData) => ({
        ...prevData,
        amountRs: convertNumberToWords(amount),
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        amountRs: "",
      }));
    }
  };

  useEffect(() => {
    convertAmountToWords();
  }, [formData.amount]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      toast.error("Please log in first");
      return;
    }

    try {
      setFormLoading(true);
      let response;
      const isEditing = vouchers.some((v) => v.voucherNo === formData.voucherNo && v.company === formData.filter);
      if (isEditing) {
        const voucherToEdit = vouchers.find((v) => v.voucherNo === formData.voucherNo && v.company === formData.filter);
        response = await axios.put(`${url}/edit-voucher/${voucherToEdit._id}`, formData, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } else {
        response = await axios.post(`${url}/submit`, formData, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }

      if (response.status === 200 || response.status === 201) {
        toast.success(response.data.message);
        setFormData({ ...initialValues, filter: "" });
        if (showVouchers) fetchVouchers();
      } else {
        throw new Error(response.data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error submitting data:", error.message);
      toast.error("Failed to submit data: " + (error.response?.data?.error || error.message));
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditVoucher = (voucher) => {
    setFormData({
      filter: voucher.company,
      voucherNo: voucher.voucherNo,
      date: voucher.date.split("T")[0],
      payTo: voucher.payTo,
      accountHead: voucher.accountHead || "",
      account: voucher.account,
      transactionType: voucher.transactionType || "UPI",
      amount: voucher.amount,
      amountRs: convertNumberToWords(parseFloat(voucher.amount)),
      checkedBy: voucher.checkedBy || "",
      approvedBy: voucher.approvedBy || "",
      receiverSignature: voucher.receiverSignature || "",
    });
    setShowVouchers(false);
    toast.info("Voucher loaded for editing. Make changes and submit to update.");
  };

  const handleDeleteVoucher = async (voucherNo) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await axios.delete(`${url}/vouchers/${voucherNo}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setVouchers(vouchers.filter((voucher) => voucher.voucherNo !== voucherNo));
        toast.success("Voucher deleted successfully");
      } catch (error) {
        console.error("Error deleting voucher:", error.message);
        toast.error("Failed to delete voucher: " + (error.response?.data?.error || error.message));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${url}/logout`);
      setToken(null);
      setUser(null);
      setFormData(initialValues);
      setVouchers([]);
      setShowVouchers(false);
      localStorage.removeItem("token");
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Error logging out:", error.message);
      toast.error("Failed to log out: " + (error.response?.data?.error || error.message));
    }
  };

  const toggleVouchers = () => {
    setShowVouchers(!showVouchers);
    if (!showVouchers) fetchVouchers();
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (showVouchers) fetchVouchers();
    }, 300);
    return () => clearTimeout(handler);
  }, [companyFilter, dateFilter, sortAmount, showVouchers]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (name === "companyFilter") setCompanyFilter(value);
    if (name === "dateFilter") setDateFilter(value);
    if (name === "sortAmount") setSortAmount(value);
  };

  return (
    <>
      <ToastContainer />
      {!user ? (
        <div className="login-container">
          <div className="login-image">
            <img src="/login-bg.jpg" alt="Login Background" />
          </div>
          <div className="login-content">
            <h2>Please Log In To Your Vouchers</h2>
            <button onClick={() => login()} className="google-login-button">
              Login with Google
            </button>
          </div>
        </div>
      ) : (
        <div className="voucher-container">
          <div className="user-info">
            {user && (
              <div className="user-profile">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="user-avatar"
                  referrerPolicy="no-referrer"
                />
                <span className="user-name">{user.name}</span>
              </div>
            )}
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : showVouchers ? (
            <div className="voucher-list-view">
              <h2>Your Vouchers</h2>
              <div className="filter-section">
                <div className="form-group">
                  <label htmlFor="companyFilter">Filter by Company</label>
                  <select
                    id="companyFilter"
                    name="companyFilter"
                    value={companyFilter}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Companies</option>
                    <option value="Contentstack">Contentstack</option>
                    <option value="Surfboard">Surfboard</option>
                    <option value="RawEngineering">Raw Engineering</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="dateFilter">Filter by Date</label>
                  <input
                    type="date"
                    id="dateFilter"
                    name="dateFilter"
                    value={dateFilter}
                    onChange={handleFilterChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sortAmount">Sort by Amount</label>
                  <select
                    id="sortAmount"
                    name="sortAmount"
                    value={sortAmount}
                    onChange={handleFilterChange}
                  >
                    <option value="">Default</option>
                    <option value="lowToHigh">Low to High</option>
                    <option value="highToLow">High to Low</option>
                  </select>
                </div>
              </div>
              {vouchers.length === 0 ? (
                <p>No vouchers match your filters. Create some vouchers to see them here.</p>
              ) : (
                <div className="voucher-list">
                  {vouchers.map((voucher) => (
                    <div key={voucher._id} className="voucher-item">
                      <p>Voucher No: {voucher.voucherNo}</p>
                      <p>Company: {voucher.company}</p>
                      <p>Date: {voucher.date}</p>
                      <p>Pay To: {voucher.payTo}</p>
                      <p>Account Head: {voucher.accountHead || "N/A"}</p>
                      <p>Towards: {voucher.account}</p>
                      <p>Transaction Type: {voucher.transactionType}</p>
                      <p>Amount: {voucher.amount}</p>
                      <a href={voucher.pdfLink} target="_blank" rel="noopener noreferrer">
                        View PDF
                      </a>
                      <br />
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${voucher.spreadsheetId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sheet-link"
                      >
                        View Sheet
                      </a>
                      <div className="voucher-actions">
                        <button className="edit-button" onClick={() => handleEditVoucher(voucher)}>
                          Edit
                        </button>
                        <button className="delete-button" onClick={() => handleDeleteVoucher(voucher.voucherNo)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="back-button" onClick={toggleVouchers}>
                Back to Form
              </button>
            </div>
          ) : (
            <>
              <h2>{formData.voucherNo ? "Edit Voucher" : "Create Voucher"}</h2>
              <form id="voucherForm" onSubmit={handleSubmit}>
                <div className="wrapper">
                  <div className="form-group">
                    <label htmlFor="filter">Select Company</label>
                    <select
                      id="filter"
                      name="filter"
                      value={formData.filter}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Options</option>
                      <option value="Contentstack">Contentstack</option>
                      <option value="Surfboard">Surfboard</option>
                      <option value="RawEngineering">Raw Engineering</option>
                    </select>
                    <div id="filterImageContainer">
                      <img
                        id="filterImage"
                        src={formData.filter ? `/${filterImageMap[formData.filter]}` : ""}
                        alt={formData.filter ? formData.filter : "Placeholder"}
                        style={{ display: formData.filter ? "block" : "none" }}
                      />
                    </div>
                  </div>
                  <div className="voucher-info">
                    <div className="form-group">
                      <label htmlFor="voucher-no">Voucher No.</label>
                      <input
                        type="text"
                        id="voucher-no"
                        name="voucherNo"
                        value={formData.voucherNo}
                        readOnly
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="date">Date</label>
                      <input
                        type="date"
                        id="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="payTo">Pay To</label>
                  <input
                    type="text"
                    id="payTo"
                    name="payTo"
                    value={formData.payTo}
                    onChange={handleChange}
                    placeholder="Enter recipient name or entity"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="accountHead">Account Head</label>
                  <input
                    type="text"
                    id="accountHead"
                    name="accountHead"
                    value={formData.accountHead}
                    onChange={handleChange}
                    placeholder="Example: Expenses, Salary"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="account">Towards the Account</label>
                  <input
                    type="text"
                    id="account"
                    name="account"
                    value={formData.account}
                    onChange={handleChange}
                    placeholder="Example: Office Supplies, Rent"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Transaction Type</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="transactionType"
                        value="UPI"
                        checked={formData.transactionType === "UPI"}
                        onChange={handleChange}
                        required
                      />
                      UPI
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="transactionType"
                        value="Cash"
                        checked={formData.transactionType === "Cash"}
                        onChange={handleChange}
                      />
                      Cash
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="transactionType"
                        value="Account"
                        checked={formData.transactionType === "Account"}
                        onChange={handleChange}
                      />
                      Account
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="amount">Amount Rs.</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className="amount-input"
                    placeholder="Enter amount in numbers"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="amount-details">
                  <label htmlFor="amountRs">The Sum</label>
                  <div className="amount-inputs">
                    <input
                      type="text"
                      id="amountRs"
                      name="amountRs"
                      value={formData.amountRs}
                      placeholder="Convert amount in words"
                      readOnly
                    />
                  </div>
                </div>
                <div className="signatures">
                  <div className="signature">
                    <label htmlFor="checkedBy">Checked By</label>
                    <input
                      type="text"
                      id="checkedBy"
                      name="checkedBy"
                      value={formData.checkedBy}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="signature">
                    <label htmlFor="approvedBy">Approved By</label>
                    <input
                      type="text"
                      id="approvedBy"
                      name="approvedBy"
                      value={formData.approvedBy}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="signature">
                    <label htmlFor="receiverSignature">Receiver Signature</label>
                    <input
                      type="text"
                      id="receiverSignature"
                      name="receiverSignature"
                      value={formData.receiverSignature}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="form-group m0">
                  <button type="submit" className="submit-button" disabled={formLoading}>
                    {formLoading ? "Submitting..." : formData.voucherNo ? "Update" : "Submit"}
                  </button>
                  <button type="button" className="view-vouchers-button" onClick={toggleVouchers}>
                    View Your Vouchers
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default VoucherForm;