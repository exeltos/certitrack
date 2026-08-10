const STORAGE_KEY = 'certitrack-language';
const originalText = new WeakMap();
const originalAttrs = new WeakMap();

const PHRASES = [
  ['Συνδεθείτε στον λογαριασμό εταιρείας, προμηθευτή ή διαχειριστή.','Sign in to your company, supplier or administrator account.'],
  ['Δημιουργήστε τον χώρο της εταιρείας σας για προμηθευτές, πιστοποιητικά και απαιτήσεις συμμόρφωσης.','Create your company workspace for suppliers, certificates and compliance requirements.'],
  ['Δημιουργήστε ένα προφίλ προμηθευτή και διαχειριστείτε τα πιστοποιητικά σας για όλες τις συνεργαζόμενες εταιρείες.','Create a supplier profile and manage your certificates for all partner companies.'],
  ['Επιβεβαιώστε το ΑΦΜ και το email του λογαριασμού για να λάβετε σύνδεσμο επαναφοράς.','Confirm the account Tax ID and email to receive a reset link.'],
  ['Επιλέξτε νέο κωδικό πρόσβασης για τον λογαριασμό σας.','Choose a new password for your account.'],
  ['Επιστροφή στη σύνδεση','Back to sign in'],
  ['Βασικά στοιχεία και ασφάλεια του λογαριασμού σας.','Basic account details and security.'],
  ['CERTITRACK / ΕΤΑΙΡΕΙΑ','CERTITRACK / COMPANY'],['CERTITRACK / ΠΡΟΜΗΘΕΥΤΗΣ','CERTITRACK / SUPPLIER'],['CERTITRACK / ΔΙΑΧΕΙΡΙΣΗ','CERTITRACK / ADMIN'],
  ['ΕΤΑΙΡΕΙΑ','COMPANY'],['ΠΡΟΜΗΘΕΥΤΗΣ','SUPPLIER'],['ΔΙΑΧΕΙΡΙΣΗ','ADMIN'],
  ['Ρυθμίσεις λογαριασμού','Account settings'],['Στοιχεία εταιρείας και ασφάλεια λογαριασμού.','Company details and account security.'],['Στοιχεία προμηθευτή και ασφάλεια λογαριασμού.','Supplier details and account security.'],
  ['Επισκόπηση','Overview'],['Προμηθευτές','Suppliers'],['Πιστοποιητικά εταιρείας','Company certificates'],['Πιστοποιητικά','Certificates'],['Συμμόρφωση','Compliance'],['Οι εταιρείες μου','My companies'],['Ρυθμίσεις','Settings'],
  ['Καρτέλα προμηθευτή','Supplier profile'],['Στοιχεία συνεργάτη και διαθέσιμα πιστοποιητικά.','Partner details and available certificates.'],
  ['Διαχείριση, ισχύς και κοινοποίηση των πιστοποιητικών σας.','Manage validity and sharing of your certificates.'],['Εταιρείες που σας έχουν αποθηκευμένο και κατάσταση πρόσβασης.','Companies that have saved you and their access status.'],
  ['Στοιχεία λογαριασμού','Account details'],['Demo mode · μόνο για προβολή','Demo mode · view only'],['Επωνυμία / Όνομα','Company / Name'],['Επωνυμία','Company name'],['Email','Email'],['ΑΦΜ','Tax ID'],['Αλλαγή κωδικού','Change password'],['Νέος κωδικός','New password'],['Επιβεβαίωση','Confirmation'],['Διαγραφή λογαριασμού','Delete account'],['Αποθήκευση','Save'],
  ['Αναζήτηση πιστοποιητικού...','Search certificate...'],['Αναζήτηση τίτλου, τύπου ή αρχείου...','Search title, type or file...'],['Αναζήτηση τίτλου πιστοποιητικού...','Search certificate title...'],['Αναζήτηση επωνυμίας, ΑΦΜ ή email...','Search company, Tax ID or email...'],
  ['Όλη η ορατότητα','All visibility'],['Διαθέσιμα σε συνεργάτες','Shared with partners'],['Διαθέσιμο στις συνεργαζόμενες εταιρείες','Available to partner companies'],['Ιδιωτικά','Private'],['Ιδιωτικό — μόνο στη δική μου λίστα','Private — only in my list'],['Ορατότητα','Visibility'],
  ['Νέο πιστοποιητικό','New certificate'],['Σύνολο','Total'],['Ενεργά','Active'],['Ενεργό','Active'],['Προς λήξη','Expiring soon'],['Ληγμένα','Expired'],['Ληγμένο','Expired'],['Κατάσταση','Status'],['Ενέργειες','Actions'],['Τύπος','Type'],['Λήξη','Expiry'],['Πιστοποιητικό','Certificate'],
  ['Προβολή','View'],['Επεξεργασία','Edit'],['Διαγραφή','Delete'],['Ακύρωση','Cancel'],['Επιλογή όλων','Select all'],['Λήψη','Download'],['Αποστολή email','Send email'],['Φόρτωση πιστοποιητικών...','Loading certificates...'],['Δεν υπάρχουν πιστοποιητικά.','No certificates found.'],
  ['Μαζική εισαγωγή','Bulk import'],['Προσθήκη προμηθευτή','Add supplier'],['Ταξινόμηση','Sort'],['Εγγεγραμμένοι πρώτα','Registered first'],['Εκκρεμείς πρώτα','Pending first'],['Εγγεγραμμένος','Registered'],['Εκκρεμής εγγραφή','Pending registration'],['Αφαίρεση προμηθευτή','Remove supplier'],
  ['Στοιχεία προμηθευτή','Supplier details'],['Βασικά στοιχεία συνεργάτη και κατάσταση λογαριασμού.','Partner details and account status.'],['Πιστοποιητικά προμηθευτή','Supplier certificates'],['Δεν υπάρχουν διαθέσιμα πιστοποιητικά.','No certificates available.'],
  ['Πρόσβαση','Access'],['Αποκλεισμένος','Blocked'],['Με πρόσβαση','Has access'],['Αποκλεισμένες','Blocked'],['Συνεργαζόμενες εταιρείες','Partner companies'],
  ['Κύρια πλοήγηση','Main navigation'],['Ειδοποιήσεις','Notifications'],['Αποσύνδεση','Sign out'],['Σκούρο θέμα','Dark mode'],['Φωτεινό θέμα','Light mode'],['Εναλλαγή σε σκούρο θέμα','Switch to dark mode'],['Εναλλαγή σε φωτεινό θέμα','Switch to light mode'],
  ['Εγγραφή Εταιρείας','Company sign up'],['Εγγραφή Προμηθευτή','Supplier sign up'],['Είσοδος','Sign in'],['Αρχική','Home'],['Εγγραφή','Sign up'],
  ['Προσοχή','Attention'],['Σφάλμα','Error'],['Επιτυχία','Success'],['Ολοκληρώθηκε','Completed'],['Ναι','Yes'],['Όχι','No'],['Άκυρο','Cancel'],['Συνέχεια','Continue'],
  ['Κατάσταση συμμόρφωσης, λήξεις και ενέργειες που χρειάζονται προσοχή.','Compliance status, expiries and actions that need attention.'],['Απαιτήσεις ανά προμηθευτή, ελλείψεις και κατάσταση συμμόρφωσης.','Requirements per supplier, missing documents and compliance status.'],
  ['Πρότυπα απαιτήσεων','Requirement profiles'],['Κατάσταση προμηθευτών','Supplier compliance status'],['Πλήρεις απαιτήσεις','All requirements met'],['Με ελλείψεις','Missing documents'],['Μη συμμορφωμένοι','Non-compliant'],['Μη συμμορφωμένος','Non-compliant'],['Συμμορφωμένος','Compliant'],['Όλες οι καταστάσεις','All statuses'],['Χωρίς απαιτήσεις','No requirements'],['Χωρίς πρότυπο','No profile'],['Κάλυψη','Coverage'],['Απαιτήσεις','Requirements'],
  ['Η συμμόρφωση των προμηθευτών σας, ','Your supplier compliance, '],['χωρίς χαμένα έγγραφα.','without missing documents.'],['Συγκεντρώστε πιστοποιητικά, ορίστε απαιτήσεις και δείτε άμεσα ποιος προμηθευτής είναι πλήρης, τι λείπει και τι λήγει.','Collect certificates, define requirements and instantly see which supplier is complete, what is missing and what is expiring.'],['Δείτε το demo','View demo'],['Χωρίς εγκατάσταση','No installation'],['Εταιρεία & προμηθευτής','Company & supplier'],['Ιδιωτικά ή κοινόχρηστα έγγραφα','Private or shared documents'],['ΑΠΟ ΤΟ ΕΓΓΡΑΦΟ ΣΤΗΝ ΑΠΟΦΑΣΗ','FROM DOCUMENT TO DECISION'],['Όχι απλώς αποθήκευση πιστοποιητικών.','More than certificate storage.'],['Το CertiTrack συνδέει τα έγγραφα με πραγματικές απαιτήσεις συμμόρφωσης.','CertiTrack connects documents with real compliance requirements.'],['1. Συγκέντρωση','1. Collect'],['2. Απαιτήσεις','2. Requirements'],['3. Συμμόρφωση','3. Compliance'],['Θέλετε να το δείτε από μέσα;','Want to see it in action?'],['Δοκιμάστε και τους δύο ρόλους χωρίς εγγραφή.','Try both roles without registration.'],['Demo Εταιρείας','Company demo'],['Demo Προμηθευτή','Supplier demo'],
  ['Γρήγορες ενέργειες','Quick actions'],['Όλοι οι προμηθευτές','All suppliers'],['Χρειάζονται ενέργεια','Needs action'],['Ελλείψεις','Missing'],['Συμμορφωμένοι','Compliant'],['Προμηθευτές που χρειάζονται προσοχή','Suppliers needing attention'],
  ['Το ΑΦΜ δεν αλλάζει από αυτή την οθόνη.','The Tax ID cannot be changed from this screen.'],['Προβολή κωδικού','Show password'],['Απόκρυψη κωδικού','Hide password'],
  ['Πιστοποιητικά και συμμόρφωση, οργανωμένα.','Certificates and compliance, organized.'],['Διαχειριστείτε πιστοποιητικά, απαιτήσεις και συνεργάτες από ένα καθαρό περιβάλλον, με άμεση εικόνα για λήξεις και ελλείψεις.','Manage certificates, requirements and partners from one clear workspace, with immediate visibility into expiries and missing documents.'],['Εταιρείες & προμηθευτές','Companies & suppliers'],
  ['Διαχείριση συνεργαζόμενων προμηθευτών και πρόσβαση στα πιστοποιητικά τους.','Manage partner suppliers and access to their certificates.'],['Κεντρική διαχείριση των πιστοποιητικών της εταιρείας.','Central management of company certificates.'],['Εταιρείες, προμηθευτές και κατάσταση της πλατφόρμας.','Companies, suppliers and platform status.'],
  ['Κατάσταση εγγραφής, πιστοποιητικά και συμμόρφωση.','Registration status, certificates and compliance.'],['Προτεραιότητα βάσει συμμόρφωσης και λήξεων','Priority based on compliance and expiries'],['Πρόσφατη δραστηριότητα','Recent activity'],['Ό,τι χρειάζεται την προσοχή σας','Items that need your attention'],['Οι προμηθευτές μου','My suppliers'],['Συνδεδεμένοι','Connected'],['Σε ισχύ','Valid'],['Εντός 30 ημερών','Within 30 days'],['Απαιτούν ενέργεια','Action required'],['Χρειάζεται ενέργεια','Action required'],
  ['Νέος προμηθευτής','New supplier'],['Αναζήτηση επωνυμίας ή ΑΦΜ...','Search company name or Tax ID...'],['Αναζήτηση επωνυμίας, ΑΦΜ ή email...','Search company name, Tax ID or email...'],['Δεν βρέθηκαν προμηθευτές','No suppliers found'],['Δοκιμάστε διαφορετική αναζήτηση ή φίλτρο κατάστασης.','Try a different search or status filter.'],['εγγραφές','records'],['πιστοποιητικά','certificates'],
  ['Μαζική εισαγωγή προμηθευτών','Bulk supplier import'],['Επίλεξε αρχείο Excel','Choose an Excel file'],['Στήλες: ΕΠΩΝΥΜΙΑ, ΑΦΜ, Email','Columns: COMPANY NAME, TAX ID, Email'],['Λήψη προτύπου','Download template'],['Έλεγχος αρχείου','Validate file'],['Επίλεξε αρχείο Excel.','Choose an Excel file.'],['Demo έλεγχος ολοκληρώθηκε','Demo validation completed'],['είναι έτοιμο για εισαγωγή. Σε demo mode δεν αποθηκεύονται αλλαγές.','is ready for import. Changes are not saved in demo mode.'],
  ['Δεν βρέθηκαν πιστοποιητικά','No certificates found'],['Αλλάξτε την αναζήτηση ή το φίλτρο κατάστασης.','Change the search or status filter.'],['Ιδιωτικό έγγραφο','Private document'],['Demo PDF','Demo PDF'],['Κοινόχρηστο','Shared'],['Ιδιωτικό','Private'],['Σε συνεργάτες','Shared'],
  ['Επεξεργασία demo πιστοποιητικού','Edit demo certificate'],['Τίτλος','Title'],['Ημερομηνία λήξης','Expiry date'],['Συμπλήρωσε τα υποχρεωτικά πεδία.','Complete the required fields.'],['Η φόρμα λειτουργεί. Σε demo mode η αλλαγή δεν γράφεται στη βάση.','The form works. Changes are not written to the database in demo mode.'],['Να αφαιρεθεί το','Remove'],['Το πιστοποιητικό αφαιρέθηκε από την τρέχουσα demo προβολή. Η αλλαγή δεν αποθηκεύεται.','The certificate was removed from the current demo view. The change is not saved.'],
  ['Αφαίρεση προμηθευτή','Remove supplier'],['Να αφαιρεθεί ο','Remove'],['Ο προμηθευτής αφαιρέθηκε από την τρέχουσα demo προβολή.','The supplier was removed from the current demo view.'],['Θέλετε να αφαιρέσετε τον προμηθευτή από τη λίστα της εταιρείας;','Remove this supplier from the company list?'],['Ο προμηθευτής υπάρχει ήδη στη λίστα σας.','This supplier is already in your list.'],['Ο προμηθευτής προστέθηκε στη λίστα σας.','The supplier was added to your list.'],
  ['Προβολή πιστοποιητικού','View certificate'],['Δεν βρέθηκε αρχείο για προβολή.','No file is available for viewing.'],['Αποτυχία προβολής','Unable to display file'],['Προηγούμενη σελίδα','Previous page'],['Επόμενη σελίδα','Next page'],['Μεγέθυνση','Zoom in'],['Σμίκρυνση','Zoom out'],['Σελίδα','Page'],
  ['Νέο Πιστοποιητικό','New certificate'],['Επεξεργασία Πιστοποιητικού','Edit certificate'],['Διαγραφή Πιστοποιητικού','Delete certificate'],['Είστε σίγουρος ότι θέλετε να διαγράψετε αυτό το πιστοποιητικό;','Are you sure you want to delete this certificate?'],['Το πιστοποιητικό διαγράφηκε επιτυχώς','Certificate deleted successfully'],['Το πιστοποιητικό αποθηκεύτηκε επιτυχώς','Certificate saved successfully'],['Συμπλήρωσε όλα τα πεδία και ανέβασε PDF','Complete all fields and upload a PDF'],['Τύπος αρχείου','File type'],['Ημ. Λήξης','Expiry date'],['ΗΜΕΡΟΜΗΝΙΑ ΛΗΞΗΣ','EXPIRY DATE'],['ΤΙΤΛΟΣ','TITLE'],['ΤΥΠΟΣ','TYPE'],
  ['Όπου εφαρμόζεται','Where applicable'],['Υποχρεωτικό','Required'],['Άδεια λειτουργίας','Operating license'],['Ασφαλιστική ενημερότητα','Social security clearance'],['Φορολογική ενημερότητα','Tax clearance'],['Ασφάλιση αστικής ευθύνης','Liability insurance'],['Νομιμοποιητικό έγγραφο','Legal document'],['Πιστοποιητικό πυρασφάλειας','Fire safety certificate'],['Βεβαίωση τεχνικής υποστήριξης','Technical support certificate'],
  ['Νέο πρότυπο απαιτήσεων','New requirement profile'],['Δεν υπάρχουν πρότυπα','No requirement profiles'],['Δημιουργήστε πρώτα πρότυπο απαιτήσεων.','Create a requirement profile first.'],['Οι απαιτήσεις ενημερώθηκαν.','Requirements updated.'],['Το πρότυπο απαιτήσεων δημιουργήθηκε.','Requirement profile created.'],['Απαιτήσεις προμηθευτή','Supplier requirements'],['Χωρίς ενεργές ελλείψεις','No active gaps'],['Χρειάζεται παρακολούθηση','Needs monitoring'],['Τρέχουσα κατάσταση','Current status'],
  ['Εταιρείες που σας έχουν αποθηκευμένο','Companies that have saved you'],['Σας έχουν αποθηκευμένο','Saved by companies'],['Συνδεδεμένοι συνεργάτες','Connected partners'],['Πρόσβαση ενεργή','Access active'],['Αποκλεισμένη Πρόσβαση','Blocked access'],['Αποκλεισμός Εταιρείας','Block company'],['Επαναφορά Πρόσβασης','Restore access'],['Θέλεις να αποκλείσεις αυτή την εταιρεία από την πρόσβαση στα πιστοποιητικά σου;','Block this company from accessing your certificates?'],['Θέλεις να επαναφέρεις την πρόσβαση αυτής της εταιρείας στα πιστοποιητικά σου;','Restore this company’s access to your certificates?'],['Η εταιρεία δεν θα μπορεί να βλέπει τα κοινόχρηστα πιστοποιητικά σας.','The company will no longer be able to view your shared certificates.'],['Η εταιρεία θα μπορεί ξανά να βλέπει τα κοινόχρηστα πιστοποιητικά σας.','The company will be able to view your shared certificates again.'],['Η εταιρεία έχει πλέον πρόσβαση στα πιστοποιητικά σου.','The company now has access to your certificates.'],['Η εταιρεία αποκλείστηκε από την πρόσβαση στα πιστοποιητικά σου.','The company was blocked from accessing your certificates.'],
  ['Αλλαγή κωδικού προσπάθεια...','Attempting password change...'],['Οι κωδικοί ταιριάζουν','Passwords match'],['Οι κωδικοί δεν ταιριάζουν','Passwords do not match'],['Ο κωδικός άλλαξε με επιτυχία.','Password changed successfully.'],['Η αλλαγή κωδικού απέτυχε.','Password change failed.'],['Τα στοιχεία ενημερώθηκαν.','Details updated.'],['Τα στοιχεία αποθηκεύτηκαν.','Details saved.'],['Συμπλήρωσε και τα δύο πεδία.','Complete both fields.'],['Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.','The new password must be at least 6 characters long.'],
  ['Σύνδεση','Sign in'],['Γίνεται σύνδεση...','Signing in...'],['Ξέχασα τον κωδικό','Forgot password'],['Δεν έλαβα email επιβεβαίωσης','Didn’t receive a confirmation email'],['Ξαναστείλε','Resend'],['ΑΦΜ ή Admin','Tax ID or Admin'],['Κωδικός','Password'],['Ξέχασα Κωδικό','Forgot password'],['ΑΦΜ Χρήστη','User Tax ID'],['Email Χρήστη','User email'],['Αποστολή Link Επαναφοράς','Send reset link'],['Ορισμός Νέου Κωδικού','Set new password'],['Ορισμός Κωδικού','Set password'],['Επαλήθευση Νέου Κωδικού','Confirm new password'],['Επιβεβαίωση Κωδικού','Confirm password'],['Έχετε ήδη λογαριασμό;','Already have an account?'],['Όνομα Εταιρείας','Company name'],['Email Εταιρείας','Company email'],['Επιβεβαίωση ΑΦΜ','Confirm Tax ID'],['Επωνυμία Προμηθευτή','Supplier name'],['Email Προμηθευτή','Supplier email'],
  ['Συνδεθήκατε με επιτυχία!','Signed in successfully!'],['Η σύνδεση απέτυχε. Προσπαθήστε ξανά.','Sign in failed. Please try again.'],['Λάθος στοιχεία','Incorrect credentials'],['Λάθος Κωδικός','Incorrect password'],['Λάθος ΑΦΜ','Incorrect Tax ID'],['Μη έγκυρη συνεδρία.','Invalid session.'],['Δεν βρέθηκε ενεργή συνεδρία.','No active session found.'],['Θέλεις σίγουρα να αποσυνδεθείς;','Are you sure you want to sign out?'],['Ναι, αποσύνδεση','Yes, sign out'],
  ['Διαγραφή Χρήστη','Delete user'],['Μπλοκάρισμα Χρήστη','Block user'],['Αποκλεισμένος Χρήστης','Blocked user'],['Επαναφορά πρόσβασης','Restore access'],['Ενεργοί οργανισμοί','Active organizations'],['Σύνολο λογαριασμών','Total accounts'],['Καταχωρημένοι','Registered'],['Εκκρεμή','Pending'],['Ημ/νία Εγγραφής','Registration date'],['Ημερομηνία Εγγραφής','Registration date'],['Αναζήτηση χρηστών...','Search users...'],['Καμία Επιλογή','No selection'],
  ['Σήμερα','Today'],['Χθες','Yesterday'],['Πριν 1 ώρα','1 hour ago'],['Πριν 18 λεπτά','18 minutes ago'],['2 ημέρες πριν','2 days ago'],['ημέρες','days'],['Ελλιπής','Incomplete'],['Πλήρης','Complete'],['Ενεργός','Active'],['Εκκρεμής','Pending'],['Μη Εγγεγραμμένος','Not registered'],['Εκκρεμή εγγραφή','Pending registration'],
  ['Πιστοποιητικά που λήγουν σύντομα','Certificates expiring soon'],['Δεν υπάρχουν επικείμενες λήξεις.','There are no upcoming expiries.'],['Δεν υπάρχουν πιστοποιητικά προς λήξη.','There are no certificates expiring soon.'],['Ειδοποιήσεις λήξης','Expiry notifications'],['Επόμενες 30 ημέρες','Next 30 days'],
  ['ΑΠΟ ΤΟ ΕΓΓΡΑΦΟ ΣΤΗΝ ΑΠΟΦΑΣΗ','FROM DOCUMENT TO DECISION'],['Εταιρικά και προμηθευτικά πιστοποιητικά σε μία οργανωμένη λίστα.','Company and supplier certificates in one organized list.'],['Ορίστε τι χρειάζεται κάθε κατηγορία ή συγκεκριμένος προμηθευτής.','Define what each category or specific supplier requires.'],['Αυτόματη εικόνα για ελλείψεις, ληγμένα και πιστοποιητικά προς λήξη.','Automatic visibility into missing, expired and expiring certificates.'],['Προεπισκόπηση CertiTrack','CertiTrack preview'],['Επισκόπηση συμμόρφωσης','Compliance overview'],['Χρειάζονται προσοχή','Needs attention'],['Κατάσταση','Status'],['Όλα τα απαιτούμενα ενεργά','All required documents active'],['1 απαιτούμενο λείπει','1 required document missing'],['24 ημέρες','24 days']
,
  ['Platform Admin','Platform Admin'],['Επισκόπηση πλατφόρμας','Platform overview'],['Συνολική εικόνα οργανισμών, συνεργασιών και δραστηριότητας.','Overview of organizations, relationships and activity.'],['Οργανισμοί','Organizations'],['Εταιρείες και προμηθευτές που χρησιμοποιούν την πλατφόρμα.','Companies and suppliers using the platform.'],['Audit log','Audit log'],['Ιστορικό ενεργειών και βασικών μεταβολών της πλατφόρμας.','History of platform actions and key changes.'],['Πρόσφατοι οργανισμοί','Recent organizations'],['Νέες και ενεργές εγγραφές στην πλατφόρμα','New and active registrations on the platform'],['Όλοι οι οργανισμοί','All organizations'],['Πρόσφατη δραστηριότητα','Recent activity'],['Συνοπτική εικόνα λειτουργίας','Operational activity summary'],['Σχέσεις συνεργασίας','Relationships'],['Στην πλατφόρμα','On the platform'],['Όλοι οι τύποι','All types'],['Εταιρείες','Companies'],['Όλες οι καταστάσεις','All statuses'],['Ενεργοί','Active'],['Εκκρεμείς','Pending'],['Αποκλεισμένοι','Blocked'],['Οργανισμός','Organization'],['Εγγραφή','Registration'],['Αναζήτηση ενέργειας, οντότητας ή οργανισμού...','Search action, entity or organization...'],['Όλες οι ενέργειες','All actions'],['Σχέσεις','Relationships'],['Λογαριασμοί','Accounts'],['Ημερομηνία','Date'],['Ενέργεια','Action'],['Οντότητα','Entity'],['Λεπτομέρειες','Details']
];

PHRASES.push(...[
  ['Εγγραφή Οργανισμού','Organization sign up'],['ΟΡΓΑΝΙΣΜΟΣ','ORGANIZATION'],['CertiTrack / Οργανισμός','CertiTrack / Organization'],
  ['Πιστοποιητικά, συνεργάτες και εκκρεμότητες σε μία ενιαία εικόνα.','Certificates, partners and pending items in one unified view.'],
  ['Διαχείριση των πιστοποιητικών που ανήκουν στον οργανισμό σας.','Manage certificates owned by your organization.'],
  ['Συνδέστε άλλους οργανισμούς και διαχειριστείτε τις μεταξύ σας σχέσεις.','Connect with other organizations and manage your relationships.'],
  ['Απαιτήσεις και κατάσταση συμμόρφωσης ανά σχέση συνεργασίας.','Requirements and compliance status for each partner relationship.'],
  ['Στοιχεία οργανισμού και ασφάλεια λογαριασμού.','Organization details and account security.'],
  ['Καρτέλα συνεργάτη','Partner profile'],['Στοιχεία συνεργάτη και κοινόχρηστα πιστοποιητικά.','Partner details and shared certificates.'],
  ['Συνεργάτες','Partners'],['Συνεργάτης','Partner'],['Συνεργασία','Partnership'],['Σχέσεις συνεργασίας','Partner relationships'],
  ['Διαχείριση συνεργατών','Manage partners'],['Όλοι οι συνεργάτες','All partners'],['Νέα συνεργασία','New partnership'],
  ['Συνδεδεμένοι οργανισμοί','Connected organizations'],['Συνδεδεμένος','Connected'],['Ενεργή συνεργασία','Active partnership'],['Ενεργή σχέση','Active relationship'],
  ['Αναμονή αποδοχής','Awaiting acceptance'],['Αίτημα προς εσάς','Incoming request'],['Απορρίφθηκε','Rejected'],['Ανενεργή','Inactive'],['Αποκλεισμένη','Blocked'],
  ['Αποδοχή','Accept'],['Απόρριψη','Reject'],['Κατάργηση συνεργασίας','Remove partnership'],['Κατάργηση','Remove'],
  ['ΑΦΜ ή email οργανισμού','Organization Tax ID or email'],['Αποστολή αιτήματος συνεργασίας','Send partnership request'],['Αποστολή αιτήματος','Send request'],['Αναζήτηση','Search'],
  ['Δεν βρέθηκε','Not found'],['Δεν υπάρχει οργανισμός με αυτά τα στοιχεία.','No organization was found with these details.'],
  ['Το αίτημα συνεργασίας στάλθηκε και περιμένει αποδοχή.','The partnership request was sent and is awaiting acceptance.'],
  ['Η συνεργασία ενεργοποιήθηκε.','The partnership is now active.'],['Η συνεργασία ενεργοποιήθηκε','The partnership is now active'],['Το αίτημα απορρίφθηκε','The request was rejected'],
  ['Η συνεργασία καταργήθηκε','The partnership was removed'],['Δεν ολοκληρώθηκε','Could not complete'],
  ['Δεν βρέθηκαν συνεργάτες','No partners found'],['Δεν υπάρχουν συνεργάτες','No partners yet'],
  ['Συνδέστε έναν οργανισμό για να ανταλλάσσετε κοινόχρηστα πιστοποιητικά.','Connect an organization to exchange shared certificates.'],
  ['Προσθέστε τον πρώτο συνεργάτη σας για να μοιράζεστε πιστοποιητικά.','Add your first partner to start sharing certificates.'],
  ['ΣΥΝΕΡΓΑΖΟΜΕΝΟΣ ΟΡΓΑΝΙΣΜΟΣ','PARTNER ORGANIZATION'],['Χωρίς επωνυμία','Unnamed organization'],
  ['Δεν υπάρχει πρόσβαση','Access unavailable'],['Η συνεργασία δεν είναι ενεργή ή δεν βρέθηκε.','The partnership is not active or could not be found.'],
  ['Δικά σας έγγραφα','Your documents'],['Έγγραφα του οργανισμού','Organization documents'],['Με βάση τα δικά σας ενεργά πιστοποιητικά','Based on your active certificates'],
  ['Πιστοποιητικά που χρειάζονται προσοχή','Certificates requiring attention'],['Ληγμένα ή κοντά στη λήξη.','Expired or nearing expiry.'],
  ['Όλα τα πιστοποιητικά','All certificates'],['Δεν υπάρχουν άμεσες εκκρεμότητες','No immediate issues'],
  ['Τα δικά σας πιστοποιητικά δεν έχουν λήξει και δεν λήγουν εντός 30 ημερών.','None of your certificates are expired or due within 30 days.'],
  ['Πολύ καλή εικόνα','Excellent status'],['Χρειάζεται παρακολούθηση','Needs monitoring'],['Χρειάζεται ενέργεια','Action required'],
  ['λήξη','expiry'],['Λήξη','Expiry'],['Εντός 30 ημερών','Within 30 days'],
  ['Οι οργανισμοί με τους οποίους είστε συνδεδεμένοι.','Organizations connected to your account.'],['Όλοι','All'],
  ['Δεν υπάρχουν ληγμένα πιστοποιητικά','No expired certificates'],['Ληγμένα πιστοποιητικά','Expired certificates'],['Κλείσιμο','Close'],
  ['Διαγραφή πιστοποιητικού;','Delete certificate?'],['Η ενέργεια δεν αναιρείται.','This action cannot be undone.'],['Αποθηκεύτηκε','Saved'],['Το πιστοποιητικό καταχωρήθηκε.','The certificate was added.'],
  ['Οι ρυθμίσεις ενημερώθηκαν.','Settings were updated.'],['Οι κωδικοί δεν ταιριάζουν.','Passwords do not match.'],['Η αποθήκευση απέτυχε.','Saving failed.'],['Αποτυχία φόρτωσης','Loading failed'],
  ['Δεν υπάρχουν σχέσεις για αξιολόγηση','No relationships to evaluate'],['Συνδέστε συνεργάτες και ορίστε απαιτήσεις πιστοποιητικών ανά σχέση.','Connect partners and define certificate requirements for each relationship.'],
  ['Οι απαιτήσεις θα εφαρμόζονται ανά σχέση συνεργασίας.','Requirements will apply per partner relationship.'],['Χωρίς πρόσβαση','No access'],
  ['Δημιουργία οργανισμού','Create organization'],['Κάθε επιχείρηση δημιουργεί έναν ενιαίο χώρο, διαχειρίζεται τα πιστοποιητικά της και συνδέεται με συνεργάτες.','Each organization has one workspace to manage its certificates and connect with partners.'],
  ['Επιβεβαίωση ΑΦΜ','Confirm Tax ID'],['Κωδικός','Password'],['Ξέχασα τον κωδικό','Forgot password'],['Δεν έλαβα email επιβεβαίωσης;','Didn’t receive the confirmation email?'],['Ξαναστείλε','Resend'],
  ['Συνδεθείτε στον λογαριασμό του οργανισμού σας ή ως διαχειριστής.','Sign in to your organization account or as an administrator.'],['ΑΦΜ ή Admin','Tax ID or Admin'],
  ['Γίνεται σύνδεση...','Signing in...'],['Καλώς ήρθατε','Welcome'],['Δεν ήταν δυνατή η σύνδεση','Could not sign in'],['Ελέγξτε τα στοιχεία σας.','Check your credentials.'],
  ['Δεν βρέθηκε οργανισμός με αυτό το ΑΦΜ.','No organization was found with this Tax ID.'],['Ο συνδυασμός ΑΦΜ και κωδικού είναι λανθασμένος.','The Tax ID and password combination is incorrect.'],['Η σύνδεση απέτυχε.','Sign in failed.'],['Ο οργανισμός είναι αποκλεισμένος από το σύστημα.','This organization is blocked.'],
  ['Συμπληρώστε όλα τα πεδία.','Complete all fields.'],['Τα ΑΦΜ δεν ταιριάζουν.','Tax IDs do not match.'],['Υπάρχει ήδη οργανισμός με αυτό το ΑΦΜ.','An organization with this Tax ID already exists.'],
  ['Όροι χρήσης','Terms of use'],['Αποδέχομαι τους όρους χρήσης','I accept the terms of use'],['Απαιτείται αποδοχή των όρων.','You must accept the terms.'],['Η εγγραφή ολοκληρώθηκε. Ελέγξτε το email σας για επιβεβαίωση.','Registration completed. Check your email to confirm your account.'],['Σφάλμα εγγραφής.','Registration failed.'],
  ['Οργανισμός ·','Organization ·'],['Ένας λογαριασμός, δικά σας πιστοποιητικά και σχέσεις με άλλους οργανισμούς.','One account, your own certificates and relationships with other organizations.'],
  ['Πιστοποιητικά οργανισμού','Organization certificates'],['Χρειάζονται παρακολούθηση','Needs monitoring'],['Χρειάζονται ενέργεια','Action required'],['Παρακολούθηση','Monitoring'],
  ['DEMO DATA · ΕΝΙΑΙΟ ORGANIZATION MODEL','DEMO DATA · UNIFIED ORGANIZATION MODEL'],['Demo δεδομένα','Demo data'],['Καμία αλλαγή δεν αποθηκεύεται','Changes are not saved'],
  ['Προβολή λεπτομερειών','View details'],['Λεπτομέρειες πιστοποιητικού','Certificate details'],['Λεπτομέρειες συνεργάτη','Partner details'],['Πίσω στους συνεργάτες','Back to partners'],
  ['Ιδιωτικό έγγραφο','Private document'],['Κοινόχρηστο σε συνεργάτες','Shared with partners'],['Ημερομηνία έκδοσης','Issue date'],['Ημερομηνία λήξης','Expiry date'],
  ['Ρυθμίσεις οργανισμού','Organization settings'],['Ασφάλεια λογαριασμού','Account security'],['Αλλαγή κωδικού πρόσβασης','Change password'],
  ['Διαγραφή λογαριασμού','Delete account'],['Demo λειτουργία','Demo mode'],['Η ενέργεια είναι διαθέσιμη στην κανονική εφαρμογή.','This action is available in the live application.'],
  ['Προηγούμενη σελίδα','Previous page'],['Επόμενη σελίδα','Next page'],['Σελίδα','Page'],['Μόνο προβολή','View only'],['Προβολή πιστοποιητικού','Certificate preview'],['Δεν βρέθηκε αρχείο για προβολή.','No file was found to preview.'],
  ['Ένας λογαριασμός ανά οργανισμό','One account per organization'],['Κάθε εταιρεία διαχειρίζεται τα δικά της πιστοποιητικά και συνδέεται με συνεργάτες για ασφαλή, ελεγχόμενη κοινοποίηση και συμμόρφωση.','Each organization manages its own certificates and connects with partners for secure, controlled sharing and compliance.'],
  ['Όλα τα πιστοποιητικά του οργανισμού σε μία κοινή, ελεγχόμενη λίστα.','All organization certificates in one controlled list.'],['Ορίστε τι απαιτείται σε κάθε συγκεκριμένη σχέση συνεργασίας.','Define what is required for each partner relationship.'],['Αυτόματη εικόνα για ελλείψεις, ληγμένα και πιστοποιητικά προς λήξη.','Instant visibility into missing, expired and expiring certificates.'],
  ['Δείτε το ενιαίο μοντέλο οργανισμού χωρίς εγγραφή.','Explore the unified organization model without signing up.'],['Demo Οργανισμού','Organization demo'],['Επισκόπηση συμμόρφωσης','Compliance overview'],['Σήμερα','Today'],['Χρειάζονται προσοχή','Needs attention'],['Κατάσταση','Status'],['Ελλιπής','Incomplete'],['Πλήρης','Complete'],['Όλα τα απαιτούμενα ενεργά','All required certificates active'],['1 απαιτούμενο λείπει','1 required item missing'],
  ['Ασφαλιστική ενημερότητα','Social security clearance'],['Φορολογική ενημερότητα','Tax clearance'],['Άδεια λειτουργίας','Operating license'],['Πιστοποιητικό πυρασφάλειας','Fire safety certificate']
]);

PHRASES.push(...[
  ['Οι αλλαγές ισχύουν μόνο μέχρι να ανανεώσετε τη σελίδα.','Changes last only until you refresh the page.'],
  ['Κατάσταση συνεργατών','Partner status'],['Συνοπτική εικόνα συμμόρφωσης ανά σχέση συνεργασίας.','Compliance overview for each partner relationship.'],
  ['Βασικά στοιχεία του λογαριασμού.','Basic account details.'],['Ασφάλεια','Security'],['Αλλαγή κωδικού πρόσβασης μόνο όταν χρειάζεται.','Change your password only when needed.'],
  ['Τα βασικά στοιχεία που χρησιμοποιούνται στο CertiTrack.','Core details used across CertiTrack.'],
  ['Η εταιρεία σας','Your organization'],['Ενιαία διαχείριση πιστοποιητικών και συνεργασιών.','Unified certificate and partnership management.'],
  ['Ένας οργανισμός μπορεί να είναι πελάτης, προμηθευτής ή συνεργάτης ανάλογα με τη συγκεκριμένη σχέση.','An organization can be a customer, supplier or partner depending on the specific relationship.'],
  ['Συμμόρφωση ανά συνεργασία','Compliance by partnership'],['Οι απαιτήσεις ανήκουν στη σχέση μεταξύ δύο οργανισμών — όχι σε έναν μόνιμο ρόλο προμηθευτή.','Requirements belong to the relationship between two organizations — not to a permanent supplier role.'],
  ['Εμφανίζονται μόνο τα πιστοποιητικά που ο συνεργάτης έχει επιτρέψει να κοινοποιούνται σε ενεργούς συνεργάτες.','Only certificates the partner has chosen to share with active partners are shown.'],
  ['Δεν υπάρχουν διαθέσιμα κοινόχρηστα πιστοποιητικά.','No shared certificates are available.'],['Κοινόχρηστα πιστοποιητικά','Shared certificates'],
  ['Φίλτρο ορατότητας','Visibility filter'],['Αποστολή','Send'],['Εξαγωγή','Export'],['Προεπισκόπηση νέου πιστοποιητικού','New certificate preview'],
  ['Παραμένει στη λίστα σου, αλλά δεν εμφανίζεται σε συνεργαζόμενες εταιρείες.','It stays in your list but is not shown to partner organizations.'],
  ['Πιστοποιητικό','Certificate'],['Απόφαση','Decision'],['Νομιμοποιητικό έγγραφο','Legal document'],['Ανάλυση','Analysis'],['Στοιχεία προϊόντος','Product details'],['Άλλο','Other'],['Καταχώρισε τύπο','Enter a type'],
  ['Νέο Πιστοποιητικό','New certificate'],['Επεξεργασία Πιστοποιητικού','Edit certificate'],['Επεξεργασία πιστοποιητικού','Edit certificate'],['Συμπλήρωσε όλα τα πεδία και ανέβασε PDF.','Complete all fields and upload a PDF.'],
  ['Δεν υπάρχουν δεδομένα.','No data available.'],['Χωρίς τίτλο','Untitled'],['Πρόσβαση ενεργή','Access active'],['Επαναφορά','Restore'],['Αποκλεισμός','Block'],
  ['Μόνο προβολή','View only'],['Προηγούμενη σελίδα','Previous page'],['Επόμενη σελίδα','Next page'],['Σμίκρυνση','Zoom out'],['Μεγέθυνση','Zoom in'],['Φόρτωση εγγράφου...','Loading document...'],['Το CertiTrack εμφανίζει το έγγραφο μέσα στην εφαρμογή χωρίς κουμπί λήψης.','CertiTrack displays the document inside the application without a download button.'],['Δεν ήταν δυνατή η ενσωματωμένη προβολή του PDF.','The embedded PDF preview could not be displayed.'],
  ['Δεν βρέθηκε το αρχείο του πιστοποιητικού.','The certificate file was not found.'],['Δεν ήταν δυνατή η ασφαλής πρόσβαση στο αρχείο.','Secure access to the file could not be established.'],
  ['Αποτυχία κλήσης','Request failed:'],['Αποτυχία αναζήτησης λογαριασμού.','Account lookup failed.'],['Παρουσιάστηκε σφάλμα.','An error occurred.'],['Φόρτωση','Loading'],
  ['Ενεργές συνεργασίες','Active partnerships'],['Εκκρεμή αιτήματα','Pending requests'],['Ενεργοί οργανισμοί','Active organizations'],['Προβολή οργανισμού','View organization'],
  ['Δεν υπάρχουν εγγραφές audit.','No audit records found.'],['Δεν υπάρχουν οργανισμοί.','No organizations found.'],
  ['Θέλετε να αποσυνδεθείτε;','Do you want to sign out?'],['Ο οργανισμός είναι αποκλεισμένος.','The organization is blocked.'],
  ['π.χ. 099999999 ή quality@company.gr','e.g. 099999999 or quality@company.com'],['Η σύνδεση με','The connection with'],['τον οργανισμό','the organization'],['θα αφαιρεθεί. Δεν διαγράφονται πιστοποιητικά κανενός οργανισμού.','will be removed. No certificates belonging to either organization will be deleted.'],
  ['Δεν μπορείτε να προσθέσετε τον ίδιο οργανισμό ως συνεργάτη.','You cannot add the same organization as a partner.'],['Υπάρχει ήδη σχέση ή εκκρεμές αίτημα με αυτόν τον οργανισμό.','A relationship or pending request already exists with this organization.'],['Ο συνεργάτης υπάρχει ήδη.','This partner already exists.'],['Ο οργανισμός βρέθηκε σε παλιό τύπο λογαριασμού. Η σύνδεση θα ενεργοποιηθεί πλήρως μετά το Organization migration.','The organization uses a legacy account type. The connection will be fully enabled after the Organization migration.'],['Η αποδοχή αιτημάτων απαιτεί το νέο Organization model.','Accepting requests requires the new Organization model.'],['Μη έγκυρη κατάσταση σχέσης.','Invalid relationship status.'],
  ['Επαναφορά Κωδικού','Reset Password'],['Νέος κωδικός','New password'],['Η σύνδεση επαναφοράς είναι μη έγκυρη ή έχει λήξει.','The reset link is invalid or has expired.'],['Ο κωδικός άλλαξε. Συνδέσου ξανά.','Password changed. Please sign in again.'],['Το link έληξε','The link has expired'],['Το link επαναφοράς έχει λήξει ή είναι άκυρο. Παρακαλώ δοκιμάστε ξανά.','The reset link has expired or is invalid. Please try again.'],['Σφάλμα επαναφοράς','Reset error'],['Μη αναγνωρίσιμο σφάλμα.','Unknown error.'],['Έλεγχος Email','Check your email'],['Έστειλα link επαναφοράς στο email σου.','A password reset link was sent to your email.'],['Το ΑΦΜ και το Email δεν ταιριάζουν με εγγεγραμμένο χρήστη.','The Tax ID and email do not match a registered account.'],
  ['Οι αλλαγές δεν αποθηκεύονται','Changes are not saved'],['Η αλλαγή ισχύει μόνο στο demo session.','This change applies only to the demo session.'],['Η αναζήτηση πραγματικού οργανισμού ενεργοποιείται μετά τη σύνδεση με τη νέα βάση.','Searching real organizations becomes available after connecting the new database.'],['Προβολή των πιστοποιητικών που ο συνεργάτης έχει διαθέσει στη σχέση.','View certificates the partner has shared with this relationship.'],['Κάλυψη','Coverage'],['Ελλείψεις ή ληγμένα','Missing or expired items'],['Πλήρεις απαιτήσεις','All requirements met'],
  ['ΟΡΓΑΝΙΣΜΟΣ','ORGANIZATION'],['ΔΙΑΧΕΙΡΙΣΗ','ADMINISTRATION'],['CertiTrack αρχική','CertiTrack home'],['Αρχική CertiTrack','CertiTrack home'],
  ['Σε συνεργάτες','Shared with partners'],['Ιδιωτικό','Private'],['Σε ','In '],[' ημέρες',' days'],['ημέρες','days']
]);

PHRASES.push(...[
 ['και συμμόρφωση, ','and compliance, '],['οργανωμένα.','organized.'],['Password πρόσβασης και διαχείριση λογαριασμού.','Password and account management.'],
 ['Έχετε λογαριασμό;','Already have an account?'],['Νέος Κωδικός','New password'],
 ['συνεργάτες','partners'],['συνεργάτη','partner'],['Ενεργή','Active'],['Έτοιμο','Done'],
 ['Αποτυχία ενημέρωσης.','Update failed.'],['Αποτυχία κατάργησης.','Removal failed.'],['Συμπληρώστε ΑΦΜ ή email.','Enter a Tax ID or email.'],['Αποτυχία δημιουργίας συνεργασίας.','Could not create the partnership.'],
 ['Το Platform Admin είναι ξεχωριστό επίπεδο από τους οργανισμούς. Η πρόσβαση σε δεδομένα άλλων tenants θα ενεργοποιηθεί μόνο μέσω server-controlled admin role και ελεγμένων RLS policies.','Platform Admin is a separate layer from organization workspaces. Access to other tenants’ data will only be enabled through a server-controlled admin role and verified RLS policies.'],
 ['Η διαγραφή οργανισμού δεν εκτελείται από αυτό το interface. Για production θα χρησιμοποιείται ελεγχόμενη διαδικασία απενεργοποίησης/αρχειοθέτησης ώστε να μη διαγράφονται αλυσιδωτά πιστοποιητικά και audit records.','Organizations are not deleted from this interface. In production, a controlled deactivation/archive process will be used so certificates and audit records are not cascade-deleted.'],
 ['Η διαγραφή οργανισμού δεν εκτελείται από αυτό το interface. Για production θα χρησιμοποιείται ελεγχόμενη διαδικασία απενεργοποίησης/αρχειοθέτησης ώστε να μη διαγράφονται αλυσιδωτά certificates και audit records.','Organizations are not deleted from this interface. In production, a controlled deactivation/archive process will be used so certificates and audit records are not cascade-deleted.'],
 ['Οργανισμοί που χρησιμοποιούν την πλατφόρμα.','Organizations using the platform.'],
 ['Συμπλήρωσε τίτλο, τύπο και ημερομηνία λήξης.','Complete the title, type and expiry date.'],
 ['Προβολή συνεργάτη','View partner'],
 ['Επεξεργασία / αντικατάσταση PDF','Edit / replace PDF'],['Απόκρυψη από συνεργάτες','Hide from partners'],['Κοινοποίηση σε συνεργάτες','Share with partners'],
 ['Απόκρυψη από συνεργάτες;','Hide from partners?'],['Κοινοποίηση σε συνεργάτες;','Share with partners?'],
 ['Το συγκεκριμένο πιστοποιητικό θα παραμείνει στη δική σας λίστα, αλλά δεν θα εμφανίζεται σε κανέναν συνεργάτη.','This certificate will remain in your list but will not be visible to any partner.'],
 ['Το συγκεκριμένο πιστοποιητικό θα είναι ορατό στους ενεργούς συνεργάτες σας.','This certificate will be visible to your active partners.'],
 ['Αντικατάσταση PDF','Replace PDF'],['(προαιρετικά)','(optional)'],['Αν επιλέξεις νέο PDF, θα αντικαταστήσει το υπάρχον αρχείο μετά την αποθήκευση.','If you select a new PDF, it will replace the existing file after saving.'],
 ['Το πιστοποιητικό και το PDF αντικαταστάθηκαν.','The certificate and PDF were replaced.'],['Οι αλλαγές αποθηκεύτηκαν.','Changes saved.'],
 ['Το πιστοποιητικό θα παραμείνει στη λίστα σας αλλά δεν θα εμφανίζεται στους συνεργάτες.','The certificate will remain in your list but will not be visible to partners.'],
 ['Το πιστοποιητικό θα είναι ξανά ορατό στους συνεργάτες.','The certificate will be visible to partners again.']
]);

PHRASES.sort((a,b) => b[0].length - a[0].length);

export function translateString(value) {
  if (!value) return value;
  let out = value;
  for (const [el,en] of PHRASES) out = out.split(el).join(en);
  return out;
}

function translateTextNode(node, lang) {
  if (!originalText.has(node)) originalText.set(node, node.nodeValue);
  const base = originalText.get(node);
  node.nodeValue = lang === 'en' ? translateString(base) : base;
}

function translateElementAttrs(el, lang) {
  const attrs = ['placeholder','aria-label','title'];
  if (!originalAttrs.has(el)) originalAttrs.set(el, {});
  const store = originalAttrs.get(el);
  for (const attr of attrs) {
    if (!el.hasAttribute?.(attr)) continue;
    if (!(attr in store)) store[attr] = el.getAttribute(attr);
    el.setAttribute(attr, lang === 'en' ? translateString(store[attr]) : store[attr]);
  }
}

function walk(root, lang) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root, lang); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttrs(root, lang);
  root.childNodes?.forEach(child => walk(child, lang));
}

function updateButton(lang) {
  const btn = document.getElementById('language-toggle');
  if (!btn) return;
  const next = lang === 'el' ? 'EN' : 'EL';
  const label = lang === 'el' ? 'Switch to English' : 'Αλλαγή σε Ελληνικά';
  const code = btn.querySelector('.ct-language-code');
  if (code) code.textContent = next;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
}

let observer;
export function applyLanguage(lang) {
  const normalized = lang === 'en' ? 'en' : 'el';
  document.documentElement.lang = normalized;
  localStorage.setItem(STORAGE_KEY, normalized);
  observer?.disconnect();
  walk(document.body, normalized);
  if (!originalText.has(document.title)) { /* document.title is not a node */ }
  const originalTitle = document.documentElement.dataset.ctOriginalTitle || document.title;
  document.documentElement.dataset.ctOriginalTitle = originalTitle;
  document.title = normalized === 'en' ? translateString(originalTitle) : originalTitle;
  updateButton(normalized);
  observer = new MutationObserver(mutations => {
    observer.disconnect();
    for (const m of mutations) {
      m.addedNodes.forEach(node => walk(node, normalized));
      if (m.type === 'attributes') translateElementAttrs(m.target, normalized);
    }
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['placeholder','aria-label','title'] });
  });
  observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['placeholder','aria-label','title'] });
  window.dispatchEvent(new CustomEvent('ct:languagechange', { detail:{ language: normalized } }));
}

export function getLanguage() { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'el'; }
export function t(el, en = null) { return getLanguage() === 'en' ? (en || translateString(el)) : el; }
export function locale() { return getLanguage() === 'en' ? 'en-GB' : 'el-GR'; }

export function initLanguage() {
  applyLanguage(getLanguage());
  document.getElementById('language-toggle')?.addEventListener('click', () => applyLanguage(getLanguage() === 'el' ? 'en' : 'el'));
}
