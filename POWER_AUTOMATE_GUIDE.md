# 🔗 Power Automate Integration - Technical Guide

## Overview
This guide helps you set up Microsoft Power Automate to automatically process inspection reports from the Electrical Inspection App.

---

## Part 1: Create Power Automate Flow

### Step-by-Step Setup

#### 1. Go to Power Automate
- Visit: https://flow.microsoft.com/
- Sign in with your Microsoft account

#### 2. Create New Flow
1. Click **Create** (left sidebar)
2. Choose **Automated cloud flow**
3. Name your flow: `Electrical Inspection Report Processor`
4. Select trigger: **When an HTTP request is received**
5. Click **Create**

#### 3. Copy the Webhook URL
- In the first action "When an HTTP request is received"
- You'll see a URL at the top like:
  ```
  https://prod-XX.region.logic.azure.com:443/workflows/xxxxx/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=xxxxx
  ```
- **Copy this URL** - you'll need it in the app

#### 4. Add JSON Schema (Optional but Recommended)
In the first action, click **Use sample payload to generate schema**

Paste this sample:
```json
{
  "userId": "inspector@company.com",
  "userName": "John Doe",
  "userPhone": "+91-9876543210",
  "product": "Plant",
  "model": "SP 70 C",
  "inspectionDate": "2024-01-15",
  "totalItems": 45,
  "okItems": 42,
  "completionPercentage": 93,
  "photosAttached": 8,
  "timestamp": "2024-01-15T14:30:00Z",
  "pdfReport": "base64_encoded_pdf_data"
}
```

---

## Part 2: Add Actions to Your Flow

### Example 1: Send Email with PDF Attachment

1. Click **+ New Step**
2. Search for **Send an email (V2)**
3. Select **Send an email (V2)** (from Office 365 Outlook)
4. Fill in:
   ```
   To: your-email@company.com
   Subject: Inspection Report - @{triggerBody()?['product']} - @{triggerBody()?['inspectionDate']}
   Body: 
   
   Inspection Report Submitted
   
   Inspector: @{triggerBody()?['userName']}
   Contact: @{triggerBody()?['userPhone']}
   Product: @{triggerBody()?['product']}
   Model: @{triggerBody()?['model']}
   Date: @{triggerBody()?['inspectionDate']}
   
   Completion: @{triggerBody()?['completionPercentage']}%
   Items OK: @{triggerBody()?['okItems']} / @{triggerBody()?['totalItems']}
   Photos: @{triggerBody()?['photosAttached']}
   
   See attached PDF report.
   
   Timestamp: @{triggerBody()?['timestamp']}
   ```

5. To add PDF attachment:
   - In "Attachments", click **Add an attachment**
   - Name: `Inspection_@{triggerBody()?['product']}_@{triggerBody()?['inspectionDate']}.pdf`
   - Content: `@{triggerBody()?['pdfReport']}`

### Example 2: Save to SharePoint

1. Click **+ New Step**
2. Search for **Create file**
3. Select **Create file** (from SharePoint)
4. Configure:
   ```
   Site Address: Your SharePoint Site
   Folder Path: /Reports/Electrical Inspections/2024
   File Name: Inspection_@{triggerBody()?['product']}_@{triggerBody()?['inspectionDate']}_@{triggerBody()?['userId']}.pdf
   File Content: @{triggerBody()?['pdfReport']}
   ```

### Example 3: Log to Excel

1. Click **+ New Step**
2. Search for **Add a row into a table**
3. Select **Add a row into a table** (from Excel Online)
4. Configure with your Excel file:
   ```
   Location: Your OneDrive or SharePoint
   Document Library: Documents
   Table: InspectionLogs
   
   Columns:
   - Inspector: @{triggerBody()?['userName']}
   - Contact: @{triggerBody()?['userPhone']}
   - Product: @{triggerBody()?['product']}
   - Model: @{triggerBody()?['model']}
   - Date: @{triggerBody()?['inspectionDate']}
   - Completion %: @{triggerBody()?['completionPercentage']}
   - OK Items: @{triggerBody()?['okItems']}
   - Total Items: @{triggerBody()?['totalItems']}
   - Photos: @{triggerBody()?['photosAttached']}
   - Timestamp: @{triggerBody()?['timestamp']}
   ```

### Example 4: Send Teams Notification

1. Click **+ New Step**
2. Search for **Post message in a chat or channel**
3. Select it (from Microsoft Teams)
4. Configure:
   ```
   Team: Your Team
   Channel: #inspections or #reports
   Message:
   
   🔍 **Inspection Report Submitted**
   
   **Inspector:** @{triggerBody()?['userName']}
   **Product:** @{triggerBody()?['product']} - @{triggerBody()?['model']}
   **Date:** @{triggerBody()?['inspectionDate']}
   
   ✅ **Results:**
   - Completion: @{triggerBody()?['completionPercentage']}%
   - Items OK: @{triggerBody()?['okItems']}/@{triggerBody()?['totalItems']}
   - Photos: @{triggerBody()?['photosAttached']}
   
   📎 PDF report attached to email
   ```

### Example 5: Create Approval Request

1. Click **+ New Step**
2. Search for **Start an approval**
3. Select **Start an approval** (from Approvals)
4. Configure:
   ```
   Approval type: Approve/Reject
   Title: Inspect Report - @{triggerBody()?['product']}
   Assigned to: manager@company.com
   Details:
   Inspector: @{triggerBody()?['userName']}
   Completion: @{triggerBody()?['completionPercentage']}%
   Items: @{triggerBody()?['okItems']}/@{triggerBody()?['totalItems']}
   
   Link: [View PDF Report]
   ```

---

## Part 3: Configure in Electrical Inspection App

### 1. In Admin Panel
- Go to **Email & Automation Configuration** tab
- Paste your Power Automate webhook URL
- Click **Save Configuration**

### 2. Test the Integration
- Fill and submit an inspection report
- Check your email/SharePoint/Excel/Teams
- Verify PDF was received with photos

---

## Part 4: Advanced Features

### Conditional Actions (If/Else)

Add logic to process only high-completion reports:

```
If @{triggerBody()?['completionPercentage']} >= 90
  Then: Send approval email to manager
  Else: Send follow-up email to inspector
```

### Delay Action

Send summary email after multiple reports:

```
1. Store report data
2. Delay 1 hour
3. Check if received 5+ reports
4. Send batch summary email
```

### Error Handling

Add error actions:

```
If workflow fails:
  - Send alert to admin
  - Log error to SharePoint
  - Retry after 5 minutes
```

---

## Troubleshooting

### Webhook Not Receiving Data

1. **Check webhook URL is active**
   - In Power Automate, under trigger "When HTTP request is received"
   - URL should show in blue box
   - If missing, re-save the flow

2. **Check browser console**
   - Open Inspection App in Chrome
   - Press F12 (Developer Tools)
   - Go to Network tab
   - Submit an inspection
   - Look for POST request to your webhook URL
   - Check response (should be 200-202)

3. **Verify webhook configuration in app**
   - Admin Panel → Email Config
   - Webhook URL must be correct
   - No extra spaces or line breaks
   - HTTPS only (not HTTP)

### PDF Not Attached

1. Check email action configuration
2. Verify attachment content path is correct
3. Test with smaller PDF first
4. Check file size limits (25 MB typical)

### Flow Not Triggering

1. **Save the flow**
   - Click **Save** button
   - Wait for confirmation

2. **Check trigger**
   - Confirm "When HTTP request is received" is active
   - Re-copy webhook URL if needed

3. **Enable flow**
   - At top of flow designer
   - Toggle should be ON (blue)

---

## Performance Tips

1. **Compress images** - Already done by app (60-70% reduction)
2. **Batch operations** - Group multiple reports before emailing
3. **Use filters** - Only process reports meeting criteria
4. **Cache data** - Store recent reports to avoid repeated processing
5. **Parallel actions** - Send email AND save to SharePoint simultaneously

---

## Security Best Practices

1. **Webhook URL**
   - Keep it private
   - Don't share in emails/docs
   - Regenerate if compromised

2. **PDF Data**
   - Contains inspection details
   - May include facility information
   - Ensure email recipients are authorized

3. **Permissions**
   - SharePoint/Excel writers
   - Teams notification members
   - Approval workflow participants

4. **Audit**
   - Power Automate logs all runs
   - Review failed runs
   - Monitor suspicious activity

---

## Sample Power Automate Flow JSON

You can import this flow into your Power Automate:

```json
{
  "triggers": {
    "When_HTTP_request_is_received": {
      "type": "Request",
      "kind": "Http",
      "inputs": {
        "schema": {
          "type": "object",
          "properties": {
            "userId": {"type": "string"},
            "userName": {"type": "string"},
            "userPhone": {"type": "string"},
            "product": {"type": "string"},
            "model": {"type": "string"},
            "inspectionDate": {"type": "string"},
            "totalItems": {"type": "integer"},
            "okItems": {"type": "integer"},
            "completionPercentage": {"type": "integer"},
            "photosAttached": {"type": "integer"},
            "timestamp": {"type": "string"},
            "pdfReport": {"type": "string"}
          }
        }
      }
    }
  },
  "actions": {
    "Send_Email": {
      "runAfter": {},
      "type": "ApiConnection",
      "inputs": {
        "host": {
          "connection": {
            "name": "shared_outlook"
          }
        },
        "method": "post",
        "path": "/Mail",
        "body": {
          "to": "your-email@company.com",
          "subject": "Inspection Report - @{triggerBody()?['product']}",
          "body": "See attached PDF report"
        }
      }
    }
  }
}
```

---

## Support & Resources

- **Power Automate Docs**: https://learn.microsoft.com/power-automate/
- **Flow Templates**: https://flow.microsoft.com/galleries/
- **Community Forum**: https://powerusers.microsoft.com/t5/Power-Automate/ct-p/MPACommunity
- **Contact Support**: https://support.microsoft.com/

---

**Ready to automate?** Follow the steps above to set up Power Automate integration now! 🚀

---

*Last Updated: 2024*
*Electrical Inspection App v2.5*
