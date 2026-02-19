//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * Very simple credit card application registry.
 *
 * - Users (any address) can submit one application.
 * - Admin can review applications and set them to Approved / Rejected.
 * - Both sides can read application status on-chain.
 *
 * This is intentionally minimal for demo / UI wiring.
 */
contract CreditCardApplications {
    enum ApplicationStatus {
        None,
        Pending,
        Approved,
        Rejected
    }

    struct Application {
        address applicant;
        ApplicationStatus status;
        uint256 createdAt;
        uint256 decidedAt;
    }

    mapping(address => Application) private _applications;
    address[] private _applicants;

    event ApplicationSubmitted(address indexed applicant);
    event ApplicationApproved(address indexed applicant);
    event ApplicationRejected(address indexed applicant);

    /**
     * Submit a credit card application.
     * Reverts if the caller already has a pending or decided application.
     */
    function submitApplication() external {
        Application storage existing = _applications[msg.sender];
        require(existing.status == ApplicationStatus.None, "Application already exists");

        _applications[msg.sender] = Application({
            applicant: msg.sender,
            status: ApplicationStatus.Pending,
            createdAt: block.timestamp,
            decidedAt: 0
        });
        _applicants.push(msg.sender);

        emit ApplicationSubmitted(msg.sender);
    }

    function getMyApplication() external view returns (Application memory) {
        return _applications[msg.sender];
    }

    function getApplication(address applicant) external view returns (Application memory) {
        return _applications[applicant];
    }

    function getApplicantCount() external view returns (uint256) {
        return _applicants.length;
    }

    function getApplicantAt(uint256 index) external view returns (address) {
        require(index < _applicants.length, "Index out of bounds");
        return _applicants[index];
    }

    /**
     * Convenience helper for admin UIs to fetch all applicant addresses.
     * For demo / localhost use only – not gas efficient for large sets.
     */
    function getAllApplicants() external view returns (address[] memory) {
        return _applicants;
    }

    function approve(address applicant) external {
        Application storage app = _applications[applicant];
        require(app.status == ApplicationStatus.Pending, "Not pending");

        app.status = ApplicationStatus.Approved;
        app.decidedAt = block.timestamp;

        emit ApplicationApproved(applicant);
    }

    function reject(address applicant) external {
        Application storage app = _applications[applicant];
        require(app.status == ApplicationStatus.Pending, "Not pending");

        app.status = ApplicationStatus.Rejected;
        app.decidedAt = block.timestamp;

        emit ApplicationRejected(applicant);
    }
}

