document.addEventListener('DOMContentLoaded', () => {
    
    // !!! IMPORTANT: Replace this placeholder with your actual Google Apps Script Web App URL. !!!
    const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbw7moG5_ahXKv2XVUbmtIj7D10IZp_ffXoan6YKlmPcyjk1rW3ko1JZHPaywuM8UYQ/exec'; 

    // --- DOM Elements ---
    const form = document.getElementById('patient-form');
    const lastVisitToggle = document.getElementById('last-visit-toggle');
    const lastVisitDetails = document.getElementById('last-visit-details');
    const formSection = document.getElementById('patient-form-section');
    const resultsSection = document.getElementById('results-section');
    const assignedDetailsDiv = document.getElementById('assigned-details');
    const printBtn = document.getElementById('print-btn');
    const printableArea = document.getElementById('printable-area');
    const viewPatientsBtn = document.getElementById('view-patients-btn');
    const patientLookupSection = document.getElementById('patient-lookup-section');
    const patientSelector = document.getElementById('patient-selector');
    const patientCardDisplay = document.getElementById('patient-card-display');
    
    // New/Renamed Buttons for clarity and correct IDs
    const goToFormResultsBtn = document.getElementById('go-to-form-btn-results');
    const goToFormLookupBtn = document.getElementById('go-to-form-btn-lookup');
    
    // Global variable to store fetched patient data
    let ALL_PATIENTS_DATA = [];

    // --- UTILITY FUNCTIONS ---
    function hideAllSections() {
        formSection.style.display = 'none';
        resultsSection.style.display = 'none';
        patientLookupSection.style.display = 'none';
    }

    function showSection(section) {
        hideAllSections();
        section.style.display = 'block';
    }

    // --- EVENT LISTENERS ---

    lastVisitToggle.addEventListener('change', () => {
        lastVisitDetails.style.display = lastVisitToggle.value === 'Yes' ? 'block' : 'none';
        lastVisitDetails.required = lastVisitToggle.value === 'Yes';
    });

    // Form Submission (CRITICAL FIX FOR COLUMN MAPPING)
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // 1. Collect & Assign Data
        const patientData = {
            name: document.getElementById('name').value,
            age: parseInt(document.getElementById('age').value),
            sex: document.getElementById('sex').value,
            number: document.getElementById('number').value,
            address: document.getElementById('address').value,
            lastVisit: document.getElementById('last-visit-toggle').value,
            lastVisitDetails: document.getElementById('last-visit-details').value,
            symptoms: document.getElementById('symptoms').value
        };

        const { uniqueId, urgencyCode, doctorType } = assignUniqueDetails(patientData.symptoms, patientData.age);

        // 2. CREATE THE FINAL DATA OBJECT IN THE EXACT ORDER OF THE SHEET HEADERS (EXCEPT TIMESTAMP)
        // Order: name, age, sex, number, address, lastVisit, lastVisitDetails, symptoms, uniqueId, urgencyCode, doctorType
        const finalData = { 
            name: patientData.name,
            age: patientData.age,
            sex: patientData.sex,
            number: patientData.number,
            address: patientData.address,
            lastVisit: patientData.lastVisit,
            lastVisitDetails: patientData.lastVisitDetails,
            symptoms: patientData.symptoms,
            uniqueId: uniqueId,
            urgencyCode: urgencyCode,
            doctorType: doctorType
        };

        // Process & Show
        const displayData = { ...patientData, uniqueId, urgencyCode, doctorType };
        displayResults(displayData); 
        pushToGoogleSheet(finalData); 
        setupPrintablePage(displayData);
        
        showSection(resultsSection);
    });

    // View Patients Button (Switches to Lookup View)
    viewPatientsBtn.addEventListener('click', () => {
        showSection(patientLookupSection);
        fetchAllPatients();
    });
    
    // Go to Homepage Buttons
    goToFormResultsBtn.addEventListener('click', () => showSection(formSection));
    goToFormLookupBtn.addEventListener('click', () => showSection(formSection));

    // Patient Selector (Lookup Logic)
    patientSelector.addEventListener('change', () => {
        const selectedId = patientSelector.value;
        if (selectedId) {
            const patient = ALL_PATIENTS_DATA.find(p => p.uniqueId === selectedId);
            if (patient) {
                renderPatientCard(patient);
            }
        } else {
            patientCardDisplay.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Select a patient to view details.</p>`;
        }
    });

    // Print Button Handler
    printBtn.addEventListener('click', () => {
        window.print();
    });

    // --- CORE LOGIC FUNCTIONS ---

    function assignUniqueDetails(symptoms, age) {
        const uniqueId = 'P-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
        
        let doctorType = 'General Practitioner';
        let urgencyCode = 'GREEN'; 

        const lowerSymptoms = symptoms.toLowerCase();

        // Doctor Type Analysis
        if (lowerSymptoms.includes('chest pain') || lowerSymptoms.includes('heart')) {
            doctorType = 'Cardiologist';
        } else if (lowerSymptoms.includes('broken') || lowerSymptoms.includes('fracture') || lowerSymptoms.includes('joint') || lowerSymptoms.includes('bone')) {
            doctorType = 'Orthopedic';
        } else if (lowerSymptoms.includes('headache') || lowerSymptoms.includes('seizure') || lowerSymptoms.includes('numbness') || lowerSymptoms.includes('stroke')) {
            doctorType = 'Neurologist';
        } else if (lowerSymptoms.includes('pregnant') || lowerSymptoms.includes('menstrual') || lowerSymptoms.includes('vaginal')) {
            doctorType = 'Gyno';
        }
        
        // Urgency Code Analysis
        if (lowerSymptoms.includes('severe chest pain') || lowerSymptoms.includes('unconscious') || lowerSymptoms.includes('heavy bleeding')) {
            urgencyCode = 'RED'; 
        } else if (lowerSymptoms.includes('broken') || lowerSymptoms.includes('high fever') || lowerSymptoms.includes('difficulty breathing') || lowerSymptoms.includes('persistent vomiting')) {
            urgencyCode = 'YELLOW'; 
        }
        
        // Age adjustment for Urgency
        if (urgencyCode === 'GREEN' && (age < 5 || age > 75)) {
            urgencyCode = 'YELLOW';
        }

        return { uniqueId, urgencyCode, doctorType };
    }

    function displayResults(data) {
        const urgencyClass = data.urgencyCode.toLowerCase();
        
        assignedDetailsDiv.innerHTML = `
            <div class="detail-item"><strong>Patient ID:</strong> ${data.uniqueId}</div>
            <div class="detail-item"><strong>Doctor Assigned:</strong> ${data.doctorType}</div>
            <div class="detail-item"><strong>Urgency Code:</strong> <span class="${urgencyClass}">${data.urgencyCode}</span></div>
            <div class="detail-item"><strong>Next Action:</strong> ${data.urgencyCode === 'RED' ? 'Immediate Admission' : 'Wait in Lounge'}</div>
        `;
        form.reset(); 
    }

    function setupPrintablePage(data) {
        printableArea.innerHTML = `
            <h3>Patient Medical Intake Card</h3>
            <div class="print-detail-group">
                <label>Date/Time:</label>
                <p>${new Date().toLocaleString()}</p>
            </div>
            
            <div class="print-detail-group">
                <label>Patient ID:</label>
                <p class="${data.urgencyCode.toLowerCase()}">${data.uniqueId}</p>
            </div>
            
            <div class="print-detail-group">
                <label>Urgency Code:</label>
                <p class="${data.urgencyCode.toLowerCase()}">${data.urgencyCode}</p>
            </div>
            
            <div class="print-detail-group">
                <label>Assigned Doctor:</label>
                <p>${data.doctorType}</p>
            </div>

            <h4>--- Personal Details ---</h4>
            <div class="print-detail-group">
                <label>Name:</label>
                <p>${data.name}</p>
                <label>Age/Sex:</label>
                <p>${data.age} / ${data.sex}</p>
            </div>

            <div class="print-detail-group">
                <label>Phone:</label>
                <p>${data.number}</p>
            </div>

            <div class="print-detail-group">
                <label>Address:</label>
                <p>${data.address}</p>
            </div>

            <h4>--- Medical Details ---</h4>
            <div class="print-detail-group">
                <label>Last Visit:</label>
                <p>${data.lastVisit}</p>
            </div>
            ${data.lastVisit === 'Yes' ? `<div class="print-symptoms"><label>Last Visit Summary:</label><p>${data.lastVisitDetails || 'N/A'}</p></div>` : ''}

            <div class="print-symptoms">
                <label>Reported Symptoms:</label>
                <p>${data.symptoms}</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px; font-style: italic;">Please present this card at the reception desk.</p>
        `;
    }

    // --- GOOGLE SHEET INTEGRATION (POST - Submission) ---
    function pushToGoogleSheet(data) {
        const formData = new FormData();
        // The data keys match the order required by the Apps Script
        for (const key in data) {
            formData.append(key, data[key]);
        }

        fetch(GOOGLE_SHEET_WEB_APP_URL, {
            method: 'POST',
            body: formData,
            mode: 'no-cors' 
        })
        .then(() => console.log('Data submission attempt sent to Google Sheet.'))
        .catch(error => console.error('Error submitting data:', error));
    }
    
    // --- GOOGLE SHEET INTEGRATION (GET - Lookup) ---
    async function fetchAllPatients() {
        patientSelector.innerHTML = '<option value="">Loading Patients...</option>';
        patientSelector.disabled = true;

        try {
            const response = await fetch(GOOGLE_SHEET_WEB_APP_URL + '?action=getPatients');
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Error parsing JSON:', text);
                patientSelector.innerHTML = '<option value="">Error fetching data (Server response not JSON)</option>';
                return;
            }

            if (data.patients && data.patients.length > 0) {
                ALL_PATIENTS_DATA = data.patients;
                populatePatientSelector(data.patients);
            } else {
                patientSelector.innerHTML = '<option value="">No patients found</option>';
            }

        } catch (error) {
            console.error('Fetch error:', error);
            patientSelector.innerHTML = '<option value="">Error connecting to server</option>';
        } finally {
            patientSelector.disabled = false;
        }
    }

    function populatePatientSelector(patients) {
        let options = '<option value="">Select a Patient (by ID or Name)</option>';
        patients.forEach(p => {
            options += `<option value="${p.uniqueId}">${p.name} (${p.uniqueId})</option>`;
        });
        patientSelector.innerHTML = options;
    }

    function renderPatientCard(data) {
        const urgencyClass = data.urgencyCode.toLowerCase();
        
        patientCardDisplay.innerHTML = `
            <div class="detail-item full-width"><strong>Record Time:</strong> ${data.timestamp}</div>

            <div class="detail-item"><strong>Patient Name:</strong> ${data.name}</div>
            <div class="detail-item"><strong>Patient ID:</strong> <span class="${urgencyClass}">${data.uniqueId}</span></div>
            
            <div class="detail-item"><strong>Age/Sex:</strong> ${data.age} / ${data.sex}</div>
            <div class="detail-item"><strong>Phone:</strong> ${data.number}</div>

            <div class="detail-item"><strong>Doctor Assigned:</strong> ${data.doctorType}</div>
            <div class="detail-item"><strong>Urgency Code:</strong> <span class="${urgencyClass}">${data.urgencyCode}</span></div>

            <div class="detail-item full-width">
                <strong>Address:</strong> ${data.address}
            </div>

            <div class="detail-item full-width">
                <strong>Symptoms Reported:</strong> ${data.symptoms}
            </div>
            
            <div class="detail-item full-width">
                <strong>Last Visit:</strong> ${data.lastVisit}
                ${data.lastVisit === 'Yes' ? `<br><span>Details: ${data.lastVisitDetails || 'N/A'}</span>` : ''}
            </div>
        `;
    }

});