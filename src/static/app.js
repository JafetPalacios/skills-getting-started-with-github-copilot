document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("search-activities");
  const sortButton = document.getElementById("sort-button");
  const exportButton = document.getElementById("export-button");
  let sortByAvailability = false;
  let allActivitiesData = {};

  // Function to get availability color
  function getAvailabilityColor(spotsLeft, maxParticipants) {
    const percentage = (spotsLeft / maxParticipants) * 100;
    if (percentage === 0) return "availability-full";
    if (percentage <= 25) return "availability-low";
    if (percentage <= 50) return "availability-medium";
    return "availability-high";
  }

  // Function to get availability text
  function getAvailabilityText(spotsLeft, maxParticipants) {
    if (spotsLeft === 0) return "Activity Full";
    return `${spotsLeft}/${maxParticipants} spots available`;
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities?_=" + Date.now());
      const activities = await response.json();
      allActivitiesData = activities;

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
      
      // Sort activities if needed
      let activitiesToDisplay = Object.entries(activities);
      if (sortByAvailability) {
        activitiesToDisplay.sort(([, a], [, b]) => {
          const spotsDiffA = b.max_participants - a.participants.length;
          const spotsDiffB = b.max_participants - b.participants.length;
          return spotsDiffA - spotsDiffB;
        });
      }

      // Populate activities list
      activitiesToDisplay.forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        activityCard.setAttribute("data-activity-name", name.toLowerCase());

        const spotsLeft = details.max_participants - details.participants.length;
        const participants = details.participants || [];
        const availabilityClass = getAvailabilityColor(spotsLeft, details.max_participants);
        const availabilityText = getAvailabilityText(spotsLeft, details.max_participants);
        const participantsList = participants.length
          ? participants.map(
              (email) => `
                <li class="participant-item">
                  <span class="participant-email">${email}</span>
                  <button
                    type="button"
                    class="delete-participant"
                    data-email="${email}"
                    data-activity="${name}"
                    aria-label="Remove ${email} from ${name}"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </li>
              `
            ).join("")
          : "<li class=\"participant-empty\">No participants yet</li>";

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <span class="availability-indicator ${availabilityClass}">${availabilityText}</span>
          <div class="participants-section">
            <p class="participants-title"><strong>Participants (${participants.length}/${details.max_participants}):</strong></p>
            <ul class="participants-list">
              ${participantsList}
            </ul>
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  async function unregisterParticipant(activity, email) {
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to remove ${email} from ${activity}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        await fetchActivities();
        await showMessage(result.message, "success");
      } else {
        await showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      await showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Function to export activities to CSV
  function exportToCSV() {
    const rows = [];
    rows.push(["Activity", "Description", "Schedule", "Max Participants", "Current Participants", "Email List"]);
    
    Object.entries(allActivitiesData).forEach(([name, details]) => {
      const emailList = details.participants.join("; ");
      rows.push([
        name,
        details.description,
        details.schedule,
        details.max_participants,
        details.participants.length,
        emailList
      ]);
    });

    const csv = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '\\"')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activities-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // Function to filter activities by search
  function filterActivities(query) {
    const cards = document.querySelectorAll(".activity-card");
    cards.forEach(card => {
      const activityName = card.getAttribute("data-activity-name");
      if (activityName.includes(query.toLowerCase())) {
        card.classList.remove("hidden-activity");
      } else {
        card.classList.add("hidden-activity");
      }
    });
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await showMessage("Please enter a valid email address.", "error");
      return;
    }

    if (!activity) {
      await showMessage("Please select an activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        signupForm.reset();
        await fetchActivities();
        await showMessage(result.message, "success");
      } else {
        await showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      await showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Handle search input
  searchInput.addEventListener("input", (event) => {
    filterActivities(event.target.value);
  });

  // Handle sort button
  sortButton.addEventListener("click", async () => {
    sortByAvailability = !sortByAvailability;
    sortButton.textContent = sortByAvailability ? "Sort by Name" : "Sort by Availability";
    await fetchActivities();
  });

  // Handle export button
  exportButton.addEventListener("click", () => {
    exportToCSV();
    showMessage("Activities exported to CSV", "success");
  });

  document.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".delete-participant");
    if (!deleteButton) {
      return;
    }

    const email = deleteButton.dataset.email;
    const activity = deleteButton.dataset.activity;
    await unregisterParticipant(activity, email);
  });

  // Initialize app
  fetchActivities();
});
