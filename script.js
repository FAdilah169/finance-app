// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAnBjo8o3AySkCxijin2cQQaXsoNtQ2iFk",
  authDomain: "keuangan-pribadi-a18bd.firebaseapp.com",
  databaseURL: "https://keuangan-pribadi-a18bd-default-rtdb.firebaseio.com",
  projectId: "keuangan-pribadi-a18bd",
  storageBucket: "keuangan-pribadi-a18bd.firebasestorage.app",
  messagingSenderId: "425653985601",
  appId: "1:425653985601:web:d787877bd6b6a599b701c0",
  measurementId: "G-74ERV0RY39"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const colRef = collection(db, "transactions");

console.log("✅ Firebase berhasil terhubung");

// DOM
const transactionForm = document.getElementById("transactionForm");
const transactionBody = document.getElementById("transactionBody");
const exportBtn = document.getElementById("exportBtn");
const excelInput = document.getElementById("excelInput");
const ctx = document.getElementById("balanceChart").getContext("2d");

// Ringkasan di web
const saldoBox = document.createElement("div");
saldoBox.id = "saldoBox";
saldoBox.style.marginTop = "20px";
saldoBox.style.fontWeight = "bold";
document.querySelector(".container").appendChild(saldoBox);

// Grafik saldo
let balanceChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Saldo",
      data: [],
      borderColor: "blue",
      backgroundColor: "rgba(0,0,255,0.1)"
    }]
  }
});

// Tambah transaksi
transactionForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const date = document.getElementById("date").value;
  const type = document.getElementById("type").value;
  const desc = document.getElementById("desc").value;
  const amount = parseFloat(document.getElementById("amount").value);

  if (!date || !desc || isNaN(amount)) return alert("Isi semua field!");

  try {
    await addDoc(colRef, { date, type, desc, amount });
    console.log("✅ Data berhasil disimpan ke Firestore");
    transactionForm.reset();
  } catch (err) {
    console.error("❌ Gagal menyimpan data:", err);
    alert("Gagal menyimpan data, cek console!");
  }
});

// Load transaksi realtime
onSnapshot(colRef, (snapshot) => {
  let transactions = [];
  transactionBody.innerHTML = "";

  snapshot.forEach((docSnap) => {
    let data = docSnap.data();
    transactions.push({ id: docSnap.id, ...data });
  });

  // Urutkan berdasarkan tanggal
  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Hitung saldo berjalan dan render tabel
  let saldo = 0;
  transactions.forEach((t) => {
    if (t.type === "pemasukan") {
      saldo += t.amount;
    } else {
      saldo -= t.amount;
    }

    let pemasukan = t.type === "pemasukan" ? t.amount : "";
    let pengeluaran = t.type === "pengeluaran" ? t.amount : "";

    let row = `
      <tr>
        <td>${t.date}</td>
        <td>${t.desc}</td>
        <td>${pemasukan}</td>
        <td>${pengeluaran}</td>
        <td>${saldo}</td>
        <td>
          <button class="deleteBtn" data-id="${t.id}">🗑️</button>
        </td>
      </tr>
    `;
    transactionBody.innerHTML += row;
  });

  updateChart(transactions);
  updateSummary(transactions);
});

// Event delegasi untuk hapus transaksi
transactionBody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("deleteBtn")) {
    let id = e.target.getAttribute("data-id");
    if (confirm("Yakin ingin menghapus transaksi ini?")) {
      try {
        await deleteDoc(doc(db, "transactions", id));
        console.log("✅ Data berhasil dihapus:", id);
      } catch (err) {
        console.error("❌ Gagal menghapus data:", err);
        alert("Gagal menghapus data, cek console!");
      }
    }
  }
});

// Update chart saldo
function updateChart(transactions) {
  let saldo = 0;
  let labels = [];
  let data = [];

  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  transactions.forEach((t) => {
    saldo += t.type === "pemasukan" ? t.amount : -t.amount;
    labels.push(t.date);
    data.push(saldo);
  });

  balanceChart.data.labels = labels;
  balanceChart.data.datasets[0].data = data;
  balanceChart.update();
}

// Update ringkasan di web
function updateSummary(transactions) {
  let saldo = 0, pemasukan = 0, pengeluaran = 0;

  transactions.forEach((t) => {
    if (t.type === "pemasukan") {
      pemasukan += t.amount;
      saldo += t.amount;
    } else {
      pengeluaran += t.amount;
      saldo -= t.amount;
    }
  });

  saldoBox.innerHTML = `
    💰 Saldo: Rp${saldo.toLocaleString()} | 
    ⬆️ Pemasukan: Rp${pemasukan.toLocaleString()} | 
    ⬇️ Pengeluaran: Rp${pengeluaran.toLocaleString()}
  `;
}

// Export Excel (dengan format Rupiah, tanpa kolom hapus)
exportBtn.addEventListener("click", () => {
  let wb = XLSX.utils.book_new();

  // Ambil tabel asli
  let table = document.querySelector("table").cloneNode(true);

  // 🔹 Hapus kolom terakhir (tombol hapus) sebelum diekspor
  table.querySelectorAll("tr").forEach((row) => {
    if (row.cells.length > 5) {
      row.deleteCell(-1); // hapus kolom terakhir
    }
  });

  // Sheet transaksi dari tabel yang sudah dibersihkan
  let ws = XLSX.utils.table_to_sheet(table);

  // Format kolom angka di sheet transaksi
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = 2; C <= 4; C++) { // kolom C (Pemasukan), D (Pengeluaran), E (Saldo)
    for (let R = 1; R <= range.e.r; R++) {
      let cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
      if (ws[cellAddress] && typeof ws[cellAddress].v === "number") {
        ws[cellAddress].t = "n";
        ws[cellAddress].z = '"Rp"#,##0';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Transaksi");

  // Hitung total
  let saldo = 0, pemasukan = 0, pengeluaran = 0;
  document.querySelectorAll("#transactionBody tr").forEach((row) => {
    let cells = row.querySelectorAll("td");
    let masuk = parseFloat(cells[2].innerText || 0);
    let keluar = parseFloat(cells[3].innerText || 0);

    if (masuk) pemasukan += masuk;
    if (keluar) pengeluaran += keluar;

    saldo = pemasukan - pengeluaran; // saldo akhir
  });

  let rows = [
    { "Total Pemasukan": pemasukan },
    { "Total Pengeluaran": pengeluaran },
    { "Saldo Akhir": saldo }
  ];

  let summarySheet = XLSX.utils.json_to_sheet(rows);

  // Format angka di sheet ringkasan
  const summaryRange = XLSX.utils.decode_range(summarySheet['!ref']);
  for (let C = 1; C <= summaryRange.e.c; C++) {
    for (let R = 0; R <= summaryRange.e.r; R++) {
      let cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
      if (summarySheet[cellAddress] && typeof summarySheet[cellAddress].v === "number") {
        summarySheet[cellAddress].t = "n";
        summarySheet[cellAddress].z = '"Rp"#,##0';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

  // Simpan file
  XLSX.writeFile(wb, "transaksi_dengan_ringkasan.xlsx");
});


// Import Excel
excelInput.addEventListener("change", (e) => {
  let file = e.target.files[0];
  let reader = new FileReader();
  reader.onload = (evt) => {
    let data = new Uint8Array(evt.target.result);
    let workbook = XLSX.read(data, { type: "array" });
    let sheet = workbook.Sheets[workbook.SheetNames[0]];
    let rows = XLSX.utils.sheet_to_json(sheet);

    rows.forEach(async (row) => {
      let type = row.Pemasukan ? "pemasukan" : "pengeluaran";
      let amount = row.Pemasukan || row.Pengeluaran;
      await addDoc(colRef, {
        date: row.Tanggal,
        type,
        desc: row.Deskripsi,
        amount
      });
    });
  };
  reader.readAsArrayBuffer(file);
});
