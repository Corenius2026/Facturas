document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos DOM
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const filePill = document.getElementById('filePill');
    const fileNameText = document.getElementById('fileNameText');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');

    const btnProcess = document.getElementById('btnProcess');
    const btnSample = document.getElementById('btnSample');

    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('emptyState');
    const resultsContainer = document.getElementById('resultsContainer');
    const engineBadge = document.getElementById('engineBadge');
    const activeEngineText = document.getElementById('activeEngineText');

    const valNIT = document.getElementById('valNIT');
    const valFecha = document.getElementById('valFecha');
    const valSubtotal = document.getElementById('valSubtotal');
    const valIVA = document.getElementById('valIVA');
    const valTotal = document.getElementById('valTotal');

    const imgOriginal = document.getElementById('imgOriginal');
    const imgProcesada = document.getElementById('imgProcesada');
    const rawTextOutput = document.getElementById('rawTextOutput');
    const xmlOutput = document.getElementById('xmlOutput');

    const btnCopyXml = document.getElementById('btnCopyXml');
    const btnDownloadXml = document.getElementById('btnDownloadXml');
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMsg = document.getElementById('toastMsg');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    let selectedFile = null;
    let currentXmlContent = "";
    let currentFilename = "factura_minimarket.xml";

    // 1. Drag & Drop y Selección
    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelect(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    function handleFileSelect(file) {
        if (!file.type.startsWith('image/')) {
            showToast("Por favor selecciona una foto o imagen válida (.jpg, .png)", "⚠️");
            return;
        }
        selectedFile = file;
        currentFilename = file.name;
        btnProcess.disabled = false;

        fileNameText.textContent = file.name;
        filePill.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (e) => {
            imgOriginal.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 2. Procesar Factura vía API (con soporte de clave de Google Gemini API)
    btnProcess.addEventListener('click', () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);
        if (geminiApiKeyInput && geminiApiKeyInput.value.trim()) {
            formData.append('gemini_api_key', geminiApiKeyInput.value.trim());
        }

        procesarFacturaAPI(formData);
    });

    // 3. Probar con Factura de Ejemplo Minimarket
    btnSample.addEventListener('click', async () => {
        showLoader("Generando recibo de proveedor de prueba...");
        
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 1050;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 800, 1050);

            ctx.fillStyle = '#000000';
            ctx.font = '22px monospace';

            const lineas = [
                "DISTRIBUIDORA ALIMENTOS Y BEBIDAS S.A.S.",
                "NIT: 900.876.543-1",
                "Factura de Venta No. FE-00892",
                "Fecha: 15/10/2025",
                "-----------------------------------------",
                "CANT  DESCRIPCION             VALOR",
                " 10   Cajas Leche Entera 1L   $450,000",
                "  5   Sacos Arroz 5kg         $180,000",
                "  2   Cajas Gaseosas 1.5L     $170,000",
                "-----------------------------------------",
                "SUBTOTAL: $800,000",
                "IVA (19%): $152,000",
                "TOTAL: $952,000",
                "-----------------------------------------",
                "¡GRACIAS POR SU COMPRA MINIMARKET!"
            ];

            let y = 70;
            lineas.forEach(l => {
                ctx.fillText(l, 50, y);
                y += 42;
            });

            canvas.toBlob((blob) => {
                const sampleFile = new File([blob], "factura_minimarket_ejemplo.png", { type: "image/png" });
                selectedFile = sampleFile;
                currentFilename = sampleFile.name;

                fileNameText.textContent = sampleFile.name;
                filePill.classList.remove('hidden');
                btnProcess.disabled = false;
                imgOriginal.src = canvas.toDataURL();

                const formData = new FormData();
                formData.append('file', sampleFile);
                if (geminiApiKeyInput && geminiApiKeyInput.value.trim()) {
                    formData.append('gemini_api_key', geminiApiKeyInput.value.trim());
                }

                procesarFacturaAPI(formData);
            });

        } catch (err) {
            hideLoader();
            showToast("Error al generar factura de prueba", "❌");
        }
    });

    async function procesarFacturaAPI(formData) {
        const usandoGemini = geminiApiKeyInput && geminiApiKeyInput.value.trim();
        const msgLoader = usandoGemini ? 
            "Analizando la factura con la API de Visión de Google Gemini AI..." : 
            "Aplicando OpenCV y Tesseract OCR...";
        
        showLoader(msgLoader);

        try {
            const response = await fetch('/api/procesar', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.detail || "Error al procesar la imagen");
            }

            // Asignar Valores
            valNIT.textContent = result.fields.NIT || "N/A";
            valFecha.textContent = result.fields.Fecha || "N/A";
            valSubtotal.textContent = result.fields.Subtotal ? `$ ${result.fields.Subtotal}` : "N/A";
            valIVA.textContent = result.fields.IVA ? `$ ${result.fields.IVA}` : "N/A";
            valTotal.textContent = result.fields.Total ? `$ ${result.fields.Total}` : "N/A";

            // Asignar Imágenes
            imgOriginal.src = result.imagen_original_b64;
            imgProcesada.src = result.imagen_procesada_b64;

            // Asignar Texto y XML
            rawTextOutput.textContent = result.raw_text;
            xmlOutput.textContent = result.xml_content;
            currentXmlContent = result.xml_content;

            // Actualizar Etiquetas de Motor
            if (engineBadge) engineBadge.textContent = result.motor_usado || "OpenCV + OCR";
            if (activeEngineText) activeEngineText.textContent = result.motor_usado || "OpenCV + OCR";

            // Mostrar Resultados
            emptyState.classList.add('hidden');
            resultsContainer.classList.remove('hidden');

            showToast(`Factura analizada con éxito (${result.motor_usado})`, "🤖");

        } catch (err) {
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                showToast("El servidor Python está desconectado. Ejecuta 'python app.py' en tu terminal.", "⚠️");
            } else {
                showToast(`Error: ${err.message}`, "❌");
            }
        } finally {
            hideLoader();
        }
    }

    // 4. Tabs Visuales
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            const targetTab = document.getElementById(btn.dataset.tab);
            if (targetTab) targetTab.classList.remove('hidden');
        });
    });

    // 5. Copiar XML
    btnCopyXml.addEventListener('click', () => {
        if (!currentXmlContent) return;
        navigator.clipboard.writeText(currentXmlContent).then(() => {
            showToast("XML de la factura copiado al portapapeles", "📋");
        });
    });

    // 6. Descargar XML
    btnDownloadXml.addEventListener('click', () => {
        if (!currentXmlContent) return;

        const blob = new Blob([currentXmlContent], { type: 'application/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentFilename.replace(/\.[^/.]+$/, "") + ".xml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("Archivo XML guardado exitosamente", "💾");
    });

    function showLoader(msg) {
        if (msg) document.getElementById('loaderText').textContent = msg;
        loader.classList.remove('hidden');
    }

    function hideLoader() {
        loader.classList.add('hidden');
    }

    function showToast(msg, icon = "✅") {
        toastMsg.textContent = msg;
        toastIcon.textContent = icon;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3500);
    }
});
